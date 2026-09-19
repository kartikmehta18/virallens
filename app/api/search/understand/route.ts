import type { NextRequest } from "next/server";
import { understandQuery } from "@/lib/ai/query";
import { getCurrentUser } from "@/lib/auth/session";
import { getCache } from "@/lib/cache";
import { clientIp, handler, json } from "@/lib/http";

/** New (uncached) queries per user/IP per hour — keeps the Gemini free-tier quota safe. */
const HOURLY_LIMIT = 60;

/** GET /api/search/understand?q=devoops → { corrected: "devops", related: ["kubernetes", …] } */
export const GET = handler(async (request: NextRequest) => {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return json({ corrected: null, related: [] });
  const user = await getCurrentUser(request);
  const used = await (await getCache()).incr(`ratelimit:understand:${user?.id ?? clientIp(request)}`, 3600);
  if (used > HOURLY_LIMIT) return json({ corrected: null, related: [] });
  return json(await understandQuery(q));
});
