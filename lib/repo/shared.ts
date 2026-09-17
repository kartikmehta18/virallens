import { creatorKey } from "../creators";
import type { CreatorRef, Post, PostQuery, SortKey } from "../types";
import type { CreatorSummary } from "./types";

export const MAX_INT = 2_147_483_647;

export const clampInt = (value: unknown): number => {
  const n = Math.round(Number(value));
  return Number.isFinite(n) ? Math.min(Math.max(n, 0), MAX_INT) : 0;
};

export const truncate = (value: string, max: number) => (value.length > max ? value.slice(0, max) : value);

/** Field + direction for each sort option (shared by both backends). */
export const SORT_FIELDS: Record<SortKey, keyof Post> = {
  trending: "trendingScore",
  engagement: "engagementScore",
  likes: "likeCount",
  comments: "commentCount",
  shares: "shareCount",
  newest: "publishedAt",
};

/** Ranks posts by the average percentile rank across several sort keys (single key: plain descending sort). */
export function rankPosts(posts: Post[], sorts: SortKey[]): Post[] {
  const value = (post: Post, key: SortKey) => {
    const v = post[SORT_FIELDS[key]];
    return typeof v === "string" ? new Date(v).getTime() : ((v as number | null) ?? 0);
  };
  const byKeyDesc = (key: SortKey) => (a: Post, b: Post) => value(b, key) - value(a, key) || a.id.localeCompare(b.id);
  if (sorts.length <= 1) return [...posts].sort(byKeyDesc(sorts[0] ?? "trending"));

  // Percentile rank in ascending order, ties share the lower rank — same as SQL PERCENT_RANK().
  const blend = new Map<string, number>(posts.map((p) => [p.id, 0]));
  for (const key of sorts) {
    const ascending = [...posts].sort((a, b) => value(a, key) - value(b, key));
    let rank = 0;
    ascending.forEach((post, i) => {
      if (i > 0 && value(post, key) !== value(ascending[i - 1], key)) rank = i;
      const pct = posts.length > 1 ? rank / (posts.length - 1) : 0;
      blend.set(post.id, blend.get(post.id)! + pct / sorts.length);
    });
  }
  return [...posts].sort((a, b) => blend.get(b.id)! - blend.get(a.id)! || byKeyDesc(sorts[0])(a, b));
}

/** Aggregates creator stats from a list of posts (memory backend, and a reference for the SQL version). */
export function summarizeCreators(posts: Post[], refs: CreatorRef[]): Record<string, CreatorSummary> {
  const wanted = new Set(refs.map(creatorKey));
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
  for (const post of posts) {
    const key = creatorKey({ platform: post.platform, handle: post.authorHandle });
    if (!wanted.has(key)) continue;
    const s = result[key];
    s.postCount++;
    s.totalLikes += post.likeCount;
    s.totalComments += post.commentCount;
    s.totalShares += post.shareCount;
    s.totalEngagement += post.engagementScore;
    s.bestTrending = Math.max(s.bestTrending, post.trendingScore);
    if (!s.lastPostAt || post.publishedAt > s.lastPostAt) {
      s.lastPostAt = post.publishedAt;
      s.name = post.authorName;
      s.avatarUrl = post.authorAvatarUrl;
    }
  }
  for (const s of Object.values(result)) s.avgEngagement = s.postCount ? s.totalEngagement / s.postCount : 0;
  return result;
}

export function matchesQuery(post: Post, query: PostQuery): boolean {
  if (query.platforms?.length && !query.platforms.includes(post.platform)) return false;
  if (query.mediaTypes?.length && !query.mediaTypes.includes(post.mediaType)) return false;
  const published = new Date(post.publishedAt).getTime();
  if (query.from && published < query.from.getTime()) return false;
  if (query.to && published > query.to.getTime()) return false;
  if (query.creators?.length && !query.creators.some((c) => c.platform === post.platform && c.handle === post.authorHandle.toLowerCase())) {
    return false;
  }
  if (query.topic) {
    const needle = query.topic.toLowerCase();
    const haystack = `${post.topic}\n${post.caption}\n${post.tags.join(" ")}\n${post.authorHandle}`.toLowerCase();
    if (!haystack.includes(needle)) return false;
  }
  return true;
}
