import type { NextRequest } from "next/server";
import { handler, json } from "@/lib/http";
import { parsePostQuery } from "@/lib/query";
import { getRepo } from "@/lib/repo";

/** GET /api/posts?topic=&platform=x,instagram&sort=likes,comments&dateRange=7d&mediaType=video&page=1&limit=24 */
export const GET = handler(async (request: NextRequest) => {
  const repo = await getRepo();
  return json(await repo.posts.search(parsePostQuery(request.nextUrl.searchParams)));
});
