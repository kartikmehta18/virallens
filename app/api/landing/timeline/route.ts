import type { NextRequest } from "next/server";
import { getCache } from "@/lib/cache";
import { handler, json } from "@/lib/http";
import { getRepo } from "@/lib/repo";
import type { TimelinePoint } from "@/lib/types";

// Public engagement curve for the landing page chart (see ../posts/route.ts).

const CACHE_TTL = 300;

/** GET /api/landing/timeline?days=30 */
export const GET = handler(async (request: NextRequest) => {
  const days = Math.min(30, Math.max(7, Number(request.nextUrl.searchParams.get("days")) || 30));

  const cache = await getCache();
  const key = `landing:timeline:${days}`;
  const cached = await cache.get(key);
  if (cached) return json(JSON.parse(cached));

  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  since.setUTCDate(since.getUTCDate() - (days - 1));

  const rows = await (await getRepo()).posts.timelineSource(undefined, undefined, since);
  const buckets = new Map<string, TimelinePoint>();
  for (let i = 0; i < days; i++) {
    const date = new Date(since.getTime() + i * 86_400_000).toISOString().slice(0, 10);
    buckets.set(date, { date, posts: 0, engagement: 0 });
  }
  for (const row of rows) {
    const bucket = buckets.get(row.publishedAt.slice(0, 10));
    if (!bucket) continue;
    bucket.posts++;
    bucket.engagement += Math.round(row.engagementScore);
  }

  const payload = { points: [...buckets.values()] };
  await cache.set(key, JSON.stringify(payload), CACHE_TTL);
  return json(payload);
});
