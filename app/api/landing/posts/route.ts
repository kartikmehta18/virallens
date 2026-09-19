import type { NextRequest } from "next/server";
import { getCache } from "@/lib/cache";
import { handler, json } from "@/lib/http";
import { getRepo } from "@/lib/repo";
import { MEDIA_TYPES, type MediaType, type Post } from "@/lib/types";

// Public showcase data for the landing page: a small sample of top-performing posts. This stays reachable
// for signed-out visitors in invite-only mode (the page is the public marketing page), while the full
// /api/posts search — filters, paging, AI breakdowns — still requires a session.

const MAX_LIMIT = 24;
const CACHE_TTL = 300;

/** Only the fields the landing visuals use; no AI breakdowns or internal scores beyond what's displayed. */
const toShowcase = (post: Post) => ({
  id: post.id,
  platform: post.platform,
  authorName: post.authorName,
  authorHandle: post.authorHandle,
  authorAvatarUrl: post.authorAvatarUrl,
  caption: post.caption.slice(0, 280),
  mediaType: post.mediaType,
  mediaUrls: post.mediaUrls.slice(0, 1),
  thumbnailUrl: post.thumbnailUrl,
  likeCount: post.likeCount,
  commentCount: post.commentCount,
  shareCount: post.shareCount,
  viewCount: post.viewCount,
  engagementScore: post.engagementScore,
  trendingScore: post.trendingScore,
  publishedAt: post.publishedAt,
});

/** GET /api/landing/posts?limit=24&mediaType=image,carousel */
export const GET = handler(async (request: NextRequest) => {
  const params = request.nextUrl.searchParams;
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(params.get("limit")) || 8));
  const mediaTypes = (params.get("mediaType") ?? "")
    .split(",")
    .map((v) => v.trim())
    .filter((v): v is MediaType => (MEDIA_TYPES as readonly string[]).includes(v));

  const cache = await getCache();
  const key = `landing:posts:${limit}:${mediaTypes.join(",")}`;
  const cached = await cache.get(key);
  if (cached) return json(JSON.parse(cached));

  const page = await (
    await getRepo()
  ).posts.search({ sort: ["trending"], mediaTypes: mediaTypes.length ? mediaTypes : undefined, page: 1, limit });
  const payload = { items: page.items.map(toShowcase), total: page.total, page: 1, limit, hasMore: false };
  await cache.set(key, JSON.stringify(payload), CACHE_TTL);
  return json(payload);
});
