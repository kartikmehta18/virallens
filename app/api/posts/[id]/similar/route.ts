import type { NextRequest } from "next/server";
import { ApiError, handler, json } from "@/lib/http";
import { getRepo } from "@/lib/repo";
import { findSimilarPosts } from "@/lib/similar";

/** GET /api/posts/[id]/similar?page=1&limit=12 → { items, page, hasMore } */
export const GET = handler(async (request: NextRequest, ctx: RouteContext<"/api/posts/[id]/similar">) => {
  const { id } = await ctx.params;
  const post = await (await getRepo()).posts.byId(id);
  if (!post) throw new ApiError(404, "Post not found");
  const params = request.nextUrl.searchParams;
  const limit = Math.min(24, Math.max(1, Number(params.get("limit")) || 12));
  const page = Math.min(50, Math.max(1, Number(params.get("page")) || 1));
  return json({ ...(await findSimilarPosts(post, page, limit)), page });
});
