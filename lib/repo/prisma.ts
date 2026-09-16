import "server-only";
import { getPrisma } from "../db/prisma";
import { creatorKey } from "../creators";
import {
  Prisma,
  type FavoriteCreator as CreatorRow,
  type Post as PostRow,
  type ScrapeJob as ScrapeJobRow,
  type WatchedTopic as WatchRow,
} from "../generated/prisma/client";
import { scorePost } from "../scoring";
import type {
  AiBreakdown,
  CreatorRef,
  FavoriteCreator,
  MediaType,
  Platform,
  Post,
  PostQuery,
  ScrapeJob,
  ScrapeRunInfo,
  SortKey,
  WatchedTopic,
} from "../types";
import { SORT_FIELDS, clampInt, truncate } from "./shared";
import type { CreatorSummary, Repository, StoredUser } from "./types";

const iso = (date: Date | null) => (date ? date.toISOString() : null);
const asArray = <T>(value: Prisma.JsonValue | null | undefined): T[] => (Array.isArray(value) ? (value as T[]) : []);

function toPost(row: PostRow): Post {
  return {
    id: row.id,
    platform: row.platform as Platform,
    authorName: row.authorName,
    authorHandle: row.authorHandle,
    authorAvatarUrl: row.authorAvatarUrl,
    caption: row.caption,
    mediaType: row.mediaType as MediaType,
    mediaUrls: asArray<string>(row.mediaUrls),
    thumbnailUrl: row.thumbnailUrl,
    postUrl: row.postUrl,
    likeCount: row.likeCount,
    commentCount: row.commentCount,
    shareCount: row.shareCount,
    viewCount: row.viewCount,
    engagementScore: row.engagementScore,
    trendingScore: row.trendingScore,
    topic: row.topic,
    tags: asArray<string>(row.tags),
    aiBreakdown: (row.aiBreakdown as AiBreakdown | null) ?? null,
    publishedAt: row.publishedAt.toISOString(),
    fetchedAt: row.fetchedAt.toISOString(),
  };
}

/** Whitelisted column per sort key — interpolated into raw SQL, so never user input. */
const SORT_COLUMNS: Record<SortKey, string> = {
  trending: "`trendingScore`",
  engagement: "`engagementScore`",
  likes: "`likeCount`",
  comments: "`commentCount`",
  shares: "`shareCount`",
  newest: "`publishedAt`",
};

/** Null-safe ORDER BY expression for a sort key (publishedAt is never null and compares as a date). */
const sortExpr = (key: SortKey) => (key === "newest" ? SORT_COLUMNS[key] : `COALESCE(${SORT_COLUMNS[key]}, 0)`);

/** WHERE clause for the raw multi-sort query; mirrors the Prisma `where` used for single sorts. */
function rawWhere(query: PostQuery): Prisma.Sql {
  const parts: Prisma.Sql[] = [Prisma.sql`1 = 1`];
  if (query.platforms?.length) parts.push(Prisma.sql`\`platform\` IN (${Prisma.join(query.platforms)})`);
  if (query.mediaTypes?.length) parts.push(Prisma.sql`\`mediaType\` IN (${Prisma.join(query.mediaTypes)})`);
  if (query.from) parts.push(Prisma.sql`\`publishedAt\` >= ${query.from}`);
  if (query.to) parts.push(Prisma.sql`\`publishedAt\` <= ${query.to}`);
  if (query.creators?.length) {
    const matches = query.creators.map((c) => Prisma.sql`(\`platform\` = ${c.platform} AND \`authorHandle\` = ${c.handle})`);
    parts.push(Prisma.sql`(${Prisma.join(matches, " OR ")})`);
  }
  if (query.topic) {
    // INSTR: plain substring match (no LIKE wildcards to escape), case-insensitive under the column collation.
    const t = query.topic;
    parts.push(Prisma.sql`(INSTR(\`topic\`, ${t}) > 0 OR INSTR(\`caption\`, ${t}) > 0 OR INSTR(\`authorHandle\`, ${t}) > 0)`);
  }
  return Prisma.join(parts, " AND ");
}

const creatorWhere = (refs: CreatorRef[]): Prisma.PostWhereInput => ({
  OR: refs.map((ref) => ({ platform: ref.platform, authorHandle: ref.handle })),
});

function toCreator(row: CreatorRow): FavoriteCreator {
  return {
    id: row.id,
    userId: row.userId,
    platform: row.platform as Platform,
    handle: row.handle,
    name: row.name,
    avatarUrl: row.avatarUrl,
    lastFetchedAt: iso(row.lastFetchedAt),
    createdAt: row.createdAt.toISOString(),
  };
}

function toJob(row: ScrapeJobRow): ScrapeJob {
  return {
    id: row.id,
    topic: row.topic,
    platforms: asArray<Platform>(row.platforms),
    status: row.status as ScrapeJob["status"],
    error: row.error,
    postsFound: row.postsFound,
    runs: asArray<ScrapeRunInfo>(row.runs),
    userId: row.userId,
    createdAt: row.createdAt.toISOString(),
    finishedAt: iso(row.finishedAt),
  };
}

function toWatch(row: WatchRow): WatchedTopic {
  return {
    id: row.id,
    userId: row.userId,
    topic: row.topic,
    platforms: asArray<Platform>(row.platforms),
    thresholdScore: row.thresholdScore,
    lastCheckedAt: iso(row.lastCheckedAt),
    createdAt: row.createdAt.toISOString(),
  };
}

function toUser(row: {
  id: string;
  username: string | null;
  email: string;
  name: string | null;
  passwordHash: string | null;
  isTest: boolean;
  createdAt: Date;
}): StoredUser {
  return { ...row, createdAt: row.createdAt.toISOString() };
}

/** Runs async tasks with bounded concurrency (keeps us under the DB connection limit). */
async function inBatches<T>(items: T[], size: number, fn: (item: T) => Promise<unknown>) {
  for (let i = 0; i < items.length; i += size) await Promise.all(items.slice(i, i + size).map(fn));
}

const boardInclude = {
  _count: { select: { posts: true } },
  posts: { take: 4, orderBy: { createdAt: "desc" }, select: { post: { select: { thumbnailUrl: true } } } },
} satisfies Prisma.BoardInclude;

type BoardWithCovers = Prisma.BoardGetPayload<{ include: typeof boardInclude }>;

const toBoardSummary = (board: BoardWithCovers) => ({
  id: board.id,
  name: board.name,
  createdAt: board.createdAt.toISOString(),
  postCount: board._count.posts,
  covers: board.posts.map((saved) => saved.post.thumbnailUrl).filter((url): url is string => Boolean(url)),
});

export function createPrismaRepository(): Repository {
  const db = getPrisma();

  const ownsBoard = async (userId: string, boardId: string) => (await db.board.count({ where: { id: boardId, userId } })) > 0;

  return {
    kind: "prisma",

    posts: {
      async upsertMany(inputs) {
        if (!inputs.length) return [];
        const rows = inputs.map((input) => {
          const scores = scorePost(input);
          return {
            platform: input.platform,
            authorName: truncate(input.authorName, 255),
            authorHandle: truncate(input.authorHandle, 255),
            authorAvatarUrl: input.authorAvatarUrl,
            caption: input.caption,
            mediaType: input.mediaType,
            mediaUrls: input.mediaUrls,
            thumbnailUrl: input.thumbnailUrl,
            postUrl: truncate(input.postUrl, 700),
            likeCount: clampInt(input.likeCount),
            commentCount: clampInt(input.commentCount),
            shareCount: clampInt(input.shareCount),
            viewCount: input.viewCount === null ? null : clampInt(input.viewCount),
            topic: truncate(input.topic, 255),
            tags: input.tags,
            publishedAt: new Date(input.publishedAt),
            fetchedAt: new Date(),
            ...scores,
          } satisfies Prisma.PostCreateManyInput;
        });

        const urls = rows.map((row) => row.postUrl);
        const existing = await db.post.findMany({ where: { postUrl: { in: urls } }, select: { postUrl: true, topic: true } });
        const existingUrls = new Map(existing.map((row) => [row.postUrl, row.topic]));

        const fresh = rows.filter((row) => !existingUrls.has(row.postUrl));
        if (fresh.length) await db.post.createMany({ data: fresh, skipDuplicates: true });

        // Refresh counts on posts we already had; keep the topic that first surfaced them.
        await inBatches(
          rows.filter((row) => existingUrls.has(row.postUrl)),
          5,
          ({ postUrl, ...data }) => db.post.update({ where: { postUrl }, data: { ...data, topic: undefined } }),
        );

        const saved = await db.post.findMany({ where: { postUrl: { in: urls } } });
        return saved.map(toPost);
      },

      async search(query) {
        const where: Prisma.PostWhereInput = {
          ...(query.platforms?.length && { platform: { in: query.platforms } }),
          ...(query.mediaTypes?.length && { mediaType: { in: query.mediaTypes } }),
          ...((query.from || query.to) && { publishedAt: { ...(query.from && { gte: query.from }), ...(query.to && { lte: query.to }) } }),
          AND: [
            ...(query.topic
              ? [
                  {
                    OR: [
                      { topic: { contains: query.topic } },
                      { caption: { contains: query.topic } },
                      { authorHandle: { contains: query.topic } },
                    ],
                  },
                ]
              : []),
            ...(query.creators?.length ? [creatorWhere(query.creators)] : []),
          ],
        };
        const skip = (query.page - 1) * query.limit;

        if (query.sort.length > 1) {
          // Blend: average PERCENT_RANK() of every selected metric within the filtered set.
          const n = query.sort.length;
          const blend = Prisma.raw(`(${query.sort.map((key) => `PERCENT_RANK() OVER (ORDER BY ${sortExpr(key)})`).join(" + ")}) / ${n}`);
          const primary = Prisma.raw(sortExpr(query.sort[0]));
          const filter = rawWhere(query);
          // Count with the same raw filter so `total` always agrees with the ranked page.
          const [[{ n: total }], ranked] = await Promise.all([
            db.$queryRaw<{ n: number | bigint }[]>`SELECT CAST(COUNT(*) AS SIGNED) AS n FROM \`Post\` WHERE ${filter}`,
            db.$queryRaw<{ id: string }[]>`
              SELECT \`id\` FROM (
                SELECT \`id\`, ${primary} AS primary_value, ${blend} AS blend
                FROM \`Post\` WHERE ${filter}
              ) ranked
              ORDER BY blend DESC, primary_value DESC, \`id\` ASC
              LIMIT ${Prisma.raw(String(Math.trunc(query.limit)))} OFFSET ${Prisma.raw(String(Math.trunc(skip)))}`,
          ]);
          const byId = new Map((await db.post.findMany({ where: { id: { in: ranked.map((r) => r.id) } } })).map((row) => [row.id, row]));
          const items = ranked.flatMap((r) => (byId.has(r.id) ? [toPost(byId.get(r.id)!)] : []));
          const count = Number(total);
          return { items, page: query.page, limit: query.limit, total: count, hasMore: skip + items.length < count };
        }

        const field = SORT_FIELDS[query.sort[0]];
        const [total, rows] = await Promise.all([
          db.post.count({ where }),
          db.post.findMany({
            where,
            orderBy: [{ [field]: "desc" }, { id: "asc" }],
            skip: (query.page - 1) * query.limit,
            take: query.limit,
          }),
        ]);
        const items = rows.map(toPost);
        return { items, page: query.page, limit: query.limit, total, hasMore: (query.page - 1) * query.limit + items.length < total };
      },

      async byId(id) {
        const row = await db.post.findUnique({ where: { id } });
        return row ? toPost(row) : null;
      },

      async similarCandidates({ excludeId, topic, platform, tags, limit }) {
        const [related, samePlatform] = await Promise.all([
          db.post.findMany({
            where: {
              id: { not: excludeId },
              OR: [{ topic }, ...tags.slice(0, 8).map((tag) => ({ tags: { array_contains: tag } }))],
            },
            orderBy: { trendingScore: "desc" },
            take: limit,
          }),
          db.post.findMany({
            where: { id: { not: excludeId }, platform },
            orderBy: { trendingScore: "desc" },
            take: Math.ceil(limit / 3),
          }),
        ]);
        const byId = new Map([...related, ...samePlatform].map((row) => [row.id, row]));
        return [...byId.values()].map(toPost);
      },

      async timelineSource(topic, platforms, since, creators) {
        return db.post
          .findMany({
            where: {
              publishedAt: { gte: since },
              ...(platforms?.length && { platform: { in: platforms } }),
              AND: [
                ...(topic ? [{ OR: [{ topic: { contains: topic } }, { caption: { contains: topic } }] }] : []),
                ...(creators?.length ? [creatorWhere(creators)] : []),
              ],
            },
            select: { publishedAt: true, engagementScore: true },
            take: 5000,
          })
          .then((rows) => rows.map((row) => ({ publishedAt: row.publishedAt.toISOString(), engagementScore: row.engagementScore })));
      },

      async setBreakdown(id, breakdown) {
        await db.post.update({ where: { id }, data: { aiBreakdown: breakdown as unknown as Prisma.InputJsonValue } });
      },

      async rescoreSince(since) {
        const rows = await db.post.findMany({
          where: { publishedAt: { gte: since } },
          select: { id: true, likeCount: true, commentCount: true, shareCount: true, viewCount: true, publishedAt: true },
        });
        await inBatches(rows, 5, (row) =>
          db.post.update({ where: { id: row.id }, data: scorePost({ ...row, publishedAt: row.publishedAt.toISOString() }) }),
        );
        return rows.length;
      },

      async count() {
        return db.post.count();
      },

      async creatorStats(refs) {
        const result: Record<string, CreatorSummary> = {};
        for (const ref of refs) {
          result[creatorKey(ref)] = {
            name: null,
            avatarUrl: null,
            postCount: 0,
            totalLikes: 0,
            totalComments: 0,
            totalShares: 0,
            totalEngagement: 0,
            avgEngagement: 0,
            bestTrending: 0,
            lastPostAt: null,
          };
        }
        if (!refs.length) return result;
        const where = creatorWhere(refs);
        const [groups, latest] = await Promise.all([
          db.post.groupBy({
            by: ["platform", "authorHandle"],
            where,
            _count: { _all: true },
            _sum: { likeCount: true, commentCount: true, shareCount: true, engagementScore: true },
            _max: { trendingScore: true, publishedAt: true },
          }),
          db.post.findMany({
            where,
            orderBy: { publishedAt: "desc" },
            distinct: ["platform", "authorHandle"],
            select: { platform: true, authorHandle: true, authorName: true, authorAvatarUrl: true },
          }),
        ]);
        for (const g of groups) {
          const s = result[creatorKey({ platform: g.platform as Platform, handle: g.authorHandle })];
          if (!s) continue;
          s.postCount = g._count._all;
          s.totalLikes = g._sum.likeCount ?? 0;
          s.totalComments = g._sum.commentCount ?? 0;
          s.totalShares = g._sum.shareCount ?? 0;
          s.totalEngagement = g._sum.engagementScore ?? 0;
          s.avgEngagement = s.postCount ? s.totalEngagement / s.postCount : 0;
          s.bestTrending = g._max.trendingScore ?? 0;
          s.lastPostAt = iso(g._max.publishedAt);
        }
        for (const row of latest) {
          const s = result[creatorKey({ platform: row.platform as Platform, handle: row.authorHandle })];
          if (s) Object.assign(s, { name: row.authorName, avatarUrl: row.authorAvatarUrl });
        }
        return result;
      },
    },

    creators: {
      async list(userId) {
        return (await db.favoriteCreator.findMany({ where: { userId }, orderBy: { createdAt: "desc" } })).map(toCreator);
      },
      async get(userId, ref) {
        const row = await db.favoriteCreator.findUnique({
          where: { userId_platform_handle: { userId, platform: ref.platform, handle: ref.handle.toLowerCase() } },
        });
        return row ? toCreator(row) : null;
      },
      async add(userId, data) {
        const handle = truncate(data.handle.toLowerCase(), 191);
        const name = truncate(data.name, 255);
        return toCreator(
          await db.favoriteCreator.upsert({
            where: { userId_platform_handle: { userId, platform: data.platform, handle } },
            create: { userId, platform: data.platform, handle, name, avatarUrl: data.avatarUrl },
            update: { name, ...(data.avatarUrl && { avatarUrl: data.avatarUrl }) },
          }),
        );
      },
      async remove(userId, id) {
        const { count } = await db.favoriteCreator.deleteMany({ where: { id, userId } });
        return count > 0;
      },
      async markFetched(ref, at, identity) {
        const where = { platform: ref.platform, handle: ref.handle.toLowerCase() };
        await db.favoriteCreator.updateMany({ where, data: { lastFetchedAt: at } });
        // MySQL compares with a case-insensitive collation, so name = handle also matches "SatyaNadella".
        if (identity?.name)
          await db.favoriteCreator.updateMany({ where: { ...where, name: where.handle }, data: { name: truncate(identity.name, 255) } });
        if (identity?.avatarUrl)
          await db.favoriteCreator.updateMany({ where: { ...where, avatarUrl: null }, data: { avatarUrl: identity.avatarUrl } });
      },
    },

    users: {
      async byId(id) {
        const row = await db.user.findUnique({ where: { id } });
        return row ? toUser(row) : null;
      },
      async byEmail(email) {
        const row = await db.user.findUnique({ where: { email: email.toLowerCase() } });
        return row ? toUser(row) : null;
      },
      async byUsername(username) {
        const row = await db.user.findUnique({ where: { username: username.toLowerCase() } });
        return row ? toUser(row) : null;
      },
      async create(data) {
        return toUser(
          await db.user.create({ data: { ...data, username: data.username?.toLowerCase() ?? null, email: data.email.toLowerCase() } }),
        );
      },
    },

    boards: {
      async list(userId) {
        const boards = await db.board.findMany({ where: { userId }, include: boardInclude, orderBy: { createdAt: "desc" } });
        return boards.map(toBoardSummary);
      },
      async get(userId, boardId) {
        const board = await db.board.findFirst({ where: { id: boardId, userId }, include: boardInclude });
        if (!board) return null;
        const saved = await db.savedPost.findMany({ where: { boardId }, include: { post: true }, orderBy: { createdAt: "desc" } });
        return { ...toBoardSummary(board), posts: saved.map((s) => toPost(s.post)) };
      },
      async create(userId, name) {
        return toBoardSummary(await db.board.create({ data: { userId, name }, include: boardInclude }));
      },
      async rename(userId, boardId, name) {
        const { count } = await db.board.updateMany({ where: { id: boardId, userId }, data: { name } });
        return count > 0;
      },
      async remove(userId, boardId) {
        const { count } = await db.board.deleteMany({ where: { id: boardId, userId } });
        return count > 0;
      },
      async addPost(userId, boardId, postId) {
        if (!(await ownsBoard(userId, boardId))) return false;
        if (!(await db.post.count({ where: { id: postId } }))) return false;
        await db.savedPost.upsert({
          where: { boardId_postId: { boardId, postId } },
          create: { boardId, postId },
          update: {},
        });
        return true;
      },
      async removePost(userId, boardId, postId) {
        if (!(await ownsBoard(userId, boardId))) return false;
        await db.savedPost.deleteMany({ where: { boardId, postId } });
        return true;
      },
      async savedMap(userId) {
        const saved = await db.savedPost.findMany({ where: { board: { userId } }, select: { postId: true, boardId: true } });
        const map: Record<string, string[]> = {};
        for (const { postId, boardId } of saved) (map[postId] ??= []).push(boardId);
        return map;
      },
    },

    jobs: {
      async create(data) {
        return toJob(
          await db.scrapeJob.create({
            data: {
              topic: truncate(data.topic, 255),
              platforms: data.platforms,
              userId: data.userId,
              runs: data.runs as unknown as Prisma.InputJsonValue,
              status: "queued",
            },
          }),
        );
      },
      async update(id, data) {
        await db.scrapeJob.update({
          where: { id },
          data: {
            ...data,
            runs: data.runs as unknown as Prisma.InputJsonValue | undefined,
            finishedAt: data.finishedAt ? new Date(data.finishedAt) : undefined,
          },
        });
      },
      async get(id) {
        const row = await db.scrapeJob.findUnique({ where: { id } });
        return row ? toJob(row) : null;
      },
    },

    watches: {
      async list(userId) {
        return (await db.watchedTopic.findMany({ where: { userId }, orderBy: { createdAt: "desc" } })).map(toWatch);
      },
      async all() {
        const rows = await db.watchedTopic.findMany({ include: { user: { select: { email: true } } } });
        return rows.map((row) => ({ ...toWatch(row), userEmail: row.user.email }));
      },
      async upsert(userId, data) {
        const topic = truncate(data.topic, 255);
        return toWatch(
          await db.watchedTopic.upsert({
            where: { userId_topic: { userId, topic } },
            create: { userId, topic, platforms: data.platforms, thresholdScore: data.thresholdScore },
            update: { platforms: data.platforms, thresholdScore: data.thresholdScore },
          }),
        );
      },
      async remove(userId, id) {
        const { count } = await db.watchedTopic.deleteMany({ where: { id, userId } });
        return count > 0;
      },
      async markChecked(id, at) {
        await db.watchedTopic.update({ where: { id }, data: { lastCheckedAt: at } });
      },
      async recordAlert(watchId, postId) {
        const { count } = await db.watchAlert.createMany({ data: [{ watchId, postId }], skipDuplicates: true });
        return count > 0;
      },
    },
  };
}
