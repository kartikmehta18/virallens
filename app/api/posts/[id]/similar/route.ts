import type { NextRequest } from "next/server";
import { ApiError, handler, json } from "@/lib/http";
import { getRepo } from "@/lib/repo";
import { findSimilarPosts } from "@/lib/similar";

export const GET = handler(async (request: NextRequest, ctx: RouteContext<"/api/posts/[id]/similar">) => {
  const { id } = await ctx.params;
  const post = await (await getRepo()).posts.byId(id);
  if (!post) throw new ApiError(404, "Post not found");
  const limit = Math.min(24, Math.max(1, Number(request.nextUrl.searchParams.get("limit")) || 12));
  return json({ items: await findSimilarPosts(post, limit) });
});
