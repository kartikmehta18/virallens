import type { NextRequest } from "next/server";
import { withRelated } from "@/lib/ai/query";
import { getCurrentUser } from "@/lib/auth/session";
import { clientIp, handler, json } from "@/lib/http";
import { parseCreatorKeys } from "@/lib/creators";
import { parsePlatforms, parsePostQuery } from "@/lib/query";
import { getRepo } from "@/lib/repo";
import type { TimelinePoint } from "@/lib/types";

const HOUR = 3_600_000;
const DAY = 86_400_000;
const MAX_DAYS = 90;

/**
 * GET /api/posts/timeline?topic=&platform=&creator=x:handle&mediaType=&dateRange=&from=&to=&days=30
 * Engagement volume over the same window and filters as the post search, so the chart's post count
 * matches the grid: hourly buckets for "24h", daily (UTC) otherwise. "all" falls back to the last `days`.
 */
export const GET = handler(async (request: NextRequest) => {
  const params = request.nextUrl.searchParams;
  const query = await withRelated(parsePostQuery(params), params, async () => (await getCurrentUser(request))?.id ?? clientIp(request));
  const topic = query.topic;
  const platforms = params.get("platform") ? parsePlatforms(params.get("platform")) : undefined;
  const creators = parseCreatorKeys(params.get("creator"));
  const hourly = params.get("dateRange") === "24h";

  const now = Date.now();
  let since: Date;
  let buckets: number;
  if (hourly) {
    since = new Date(Math.floor(now / HOUR) * HOUR - 23 * HOUR);
    buckets = 24;
  } else {
    const end = query.to ?? new Date(now);
    const endDay = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());
    const fallbackDays = Math.min(MAX_DAYS, Math.max(1, Number(params.get("days")) || 30));
    const startDay = query.from
      ? Date.UTC(query.from.getUTCFullYear(), query.from.getUTCMonth(), query.from.getUTCDate())
      : endDay - (fallbackDays - 1) * DAY;
    buckets = Math.min(MAX_DAYS, Math.max(1, Math.round((endDay - startDay) / DAY) + 1));
    since = new Date(endDay - (buckets - 1) * DAY);
    // The post search's own lower bound is exact ("7d" = the last 168 hours), keep it when it's later.
    if (query.from && query.from > since) since = query.from;
  }

  // Same rule as the post search (lib/query.ts): with a keyword, creators only reorder results, so the
  // chart covers everyone's matching posts.
  const rows = await (await getRepo()).posts.timelineSource(topic, platforms, since, {
    creators: topic ? undefined : creators,
    mediaTypes: query.mediaTypes,
    to: query.to,
    related: query.related,
  });

  const step = hourly ? HOUR : DAY;
  const first = hourly ? since.getTime() : Date.UTC(since.getUTCFullYear(), since.getUTCMonth(), since.getUTCDate());
  const keyOf = (iso: string) => (hourly ? iso.slice(0, 13) : iso.slice(0, 10));
  const points = new Map<string, TimelinePoint>();
  for (let i = 0; i < buckets; i++) {
    const date = keyOf(new Date(first + i * step).toISOString());
    points.set(date, { date, posts: 0, engagement: 0 });
  }
  for (const row of rows) {
    const bucket = points.get(keyOf(row.publishedAt));
    if (!bucket) continue;
    bucket.posts++;
    bucket.engagement += Math.round(row.engagementScore);
  }
  return json({ points: [...points.values()], granularity: hourly ? "hour" : "day" });
});
