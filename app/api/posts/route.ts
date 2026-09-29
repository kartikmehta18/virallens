import type { NextRequest } from "next/server";
import { withRelated } from "@/lib/ai/query";
import { getCurrentUser } from "@/lib/auth/session";
import { clientIp, handler, json } from "@/lib/http";
import { parsePostQuery } from "@/lib/query";
import { getRepo } from "@/lib/repo";

/**
 * GET /api/posts?topic=&platform=x,instagram&sort=likes,comments&dateRange=7d&mediaType=video&page=1&limit=24
 * A topic also matches its AI-related searches ("ai" → chatgpt, llm, …) unless exact=1.
 */
export const GET = handler(async (request: NextRequest) => {
  const repo = await getRepo();
  const params = request.nextUrl.searchParams;
  const query = await withRelated(parsePostQuery(params), params, async () => (await getCurrentUser(request))?.id ?? clientIp(request));
  return json(await repo.posts.search(query));
});
