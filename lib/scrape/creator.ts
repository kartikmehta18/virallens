import "server-only";
import { demoCreatorTopic, generateDemoPosts } from "../apify/demo";
import { NORMALIZERS } from "../apify/normalize";
import { scrapeCreator } from "../apify/profiles";
import { getCache } from "../cache";
import { creatorKey } from "../creators";
import { env } from "../env";
import { ApiError } from "../http";
import { getRepo } from "../repo";
import type { CreatorRef, PostInput } from "../types";

export interface CreatorFetchResult {
  /** "exhausted": `more` was asked but the creator's timeline can't be fetched any further back. */
  status: "fetched" | "cached" | "exhausted";
  postsFound: number;
  /** Posts that weren't stored before this fetch (capped), for the "Just fetched" section. */
  newPostIds: string[];
  source: "apify" | "demo";
}

const DEPTH_TTL = 7 * 24 * 60 * 60;
const MAX_X_STEPS = 6;
const NEW_IDS_CAP = 200;

/**
 * Pulls a creator's latest posts (Apify profile actors, or deterministic demo posts without a token) and
 * stores them. Results stay fresh for SCRAPE_CACHE_TTL unless `force` is set.
 *
 * `more` goes further back in the timeline. On X it pages back: posts older than the oldest one stored,
 * so every click brings new posts at the normal price. LinkedIn and Instagram profile actors can only
 * filter by "newer than", so there it re-fetches with double the previous N (up to 4× APIFY_MAX_ITEMS).
 */
export async function fetchCreatorPosts(options: {
  ref: CreatorRef;
  name?: string | null;
  avatarUrl?: string | null;
  rateKey: string;
  force?: boolean;
  more?: boolean;
}): Promise<CreatorFetchResult> {
  const { ref } = options;
  const cache = await getCache();
  const repo = await getRepo();
  const source = env.apifyToken ? "apify" : "demo";
  const freshKey = `creator:fresh:${creatorKey(ref)}`;
  const depthKey = `creator:depth:${creatorKey(ref)}`;
  const doneKey = `creator:more-done:${creatorKey(ref)}`;
  const exhausted: CreatorFetchResult = { status: "exhausted", postsFound: 0, newPostIds: [], source };
  const pageBack = Boolean(options.more) && ref.platform === "x";

  let limit = env.apifyMaxItems;
  /** Demo mode: how many "pages" of seeded posts to generate. */
  let demoPages = 1;
  let claim: string | null = null;
  if (pageBack) {
    const step = (Number(await cache.get(depthKey)) || 0) + 1;
    if (step > MAX_X_STEPS || (await cache.get(doneKey))) return exhausted;
    claim = String(step);
    demoPages = step + 1;
  } else if (options.more) {
    const maxDepth = Math.min(env.apifyMaxItems * 4, 500);
    const depth = Number(await cache.get(depthKey)) || env.apifyMaxItems;
    if (depth >= maxDepth) return exhausted;
    limit = Math.min(depth * 2, maxDepth);
    claim = String(limit);
    demoPages = Math.min(limit / env.apifyMaxItems, 4);
  } else if (!options.force && (await cache.get(freshKey))) {
    return { status: "cached", postsFound: 0, newPostIds: [], source };
  }

  const used = await cache.incr(`ratelimit:scrape:${options.rateKey}`, 3600);
  if (used > env.scrapeRateLimit) throw new ApiError(429, "Fetch limit reached — try again later");
  // Claim the step/depth up front, so a second "load more" goes further instead of repeating this one.
  if (claim) await cache.set(depthKey, claim, DEPTH_TTL);

  // Existing posts tell us the creator's display name, avatar and usual niche.
  const known = (await repo.posts.creatorStats([ref]))[creatorKey(ref)];
  const name = options.name?.trim() || known?.name || ref.handle;
  const avatarUrl = options.avatarUrl || known?.avatarUrl || null;

  let inputs: PostInput[];
  if (source === "demo") {
    await new Promise((resolve) => setTimeout(resolve, 900));
    const recent = await repo.posts.search({ creators: [ref], sort: ["newest"], page: 1, limit: 1 });
    const topic = recent.items[0]?.topic ?? demoCreatorTopic(ref.handle);
    // Seeded, so a deeper fetch returns the same first posts plus new ones.
    inputs = generateDemoPosts(topic, ref.platform, Math.round(12 * demoPages), { handle: ref.handle, name, avatarUrl });
  } else {
    const before = pageBack ? await repo.posts.oldestPublished("x", { authorHandle: ref.handle }) : null;
    const raw = await scrapeCreator(ref, limit, before);
    inputs = raw
      .map((item) => NORMALIZERS[ref.platform](item, `@${ref.handle}`))
      .filter((post): post is PostInput => post !== null)
      // Profile actors can include reposts; keep the creator's own posts.
      .filter((post) => post.authorHandle.toLowerCase() === ref.handle.toLowerCase());
  }

  const { posts: saved, createdIds } = await repo.posts.upsertMany(inputs);
  const fresh = saved.length ? (await repo.posts.creatorStats([ref]))[creatorKey(ref)] : null;
  await repo.creators.markFetched(ref, new Date(), { name: fresh?.name ?? null, avatarUrl: fresh?.avatarUrl ?? null });
  await cache.set(freshKey, "1", env.scrapeCacheTtl);
  // Paging back on X found nothing older: the timeline is used up.
  if (pageBack && !createdIds.length) await cache.set(doneKey, "1", DEPTH_TTL);
  return { status: "fetched", postsFound: saved.length, newPostIds: createdIds.slice(0, NEW_IDS_CAP), source };
}
