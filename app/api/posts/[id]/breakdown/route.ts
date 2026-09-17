import type { NextRequest } from "next/server";
import { generateBreakdown } from "@/lib/ai/breakdown";
import { getCache } from "@/lib/cache";
import { ApiError, clientIp, handler, json } from "@/lib/http";
import { getRepo } from "@/lib/repo";

export const maxDuration = 60;

/** POST /api/posts/[id]/breakdown — returns the cached AI breakdown, or generates one (?refresh=1 forces regeneration). */
export const POST = handler(async (request: NextRequest, ctx: RouteContext<"/api/posts/[id]/breakdown">) => {
  const { id } = await ctx.params;
  const repo = await getRepo();
  const post = await repo.posts.byId(id);
  if (!post) throw new ApiError(404, "Post not found");

  const refresh = request.nextUrl.searchParams.get("refresh") === "1";
  if (post.aiBreakdown && !refresh) return json(post.aiBreakdown);

  const cache = await getCache();
  if ((await cache.incr(`ratelimit:ai:${clientIp(request)}`, 3600)) > 60) {
    throw new ApiError(429, "Too many AI requests — try again later");
  }

  const breakdown = await generateBreakdown(post);
  await repo.posts.setBreakdown(post.id, breakdown);
  return json(breakdown);
});
