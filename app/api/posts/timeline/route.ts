import type { NextRequest } from "next/server";
import { handler, json } from "@/lib/http";
import { parseCreatorKeys } from "@/lib/creators";
import { parsePlatforms } from "@/lib/query";
import { getRepo } from "@/lib/repo";
import type { TimelinePoint } from "@/lib/types";

/** GET /api/posts/timeline?topic=&platform=&creator=x:handle&days=30 — engagement volume bucketed by day (UTC). */
export const GET = handler(async (request: NextRequest) => {
  const params = request.nextUrl.searchParams;
  const days = Math.min(90, Math.max(1, Number(params.get("days")) || 30));
  const topic = params.get("topic")?.trim() || undefined;
  const platforms = params.get("platform") ? parsePlatforms(params.get("platform")) : undefined;
  const creators = parseCreatorKeys(params.get("creator"));

  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  since.setUTCDate(since.getUTCDate() - (days - 1));

  // Same rule as the post search (lib/query.ts): with a keyword, creators only reorder results, so the
  // chart covers everyone's matching posts.
  const rows = await (await getRepo()).posts.timelineSource(topic, platforms, since, topic ? undefined : creators);
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
  return json({ points: [...buckets.values()] });
});
