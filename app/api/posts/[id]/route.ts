import type { NextRequest } from "next/server";
import { ApiError, handler, json } from "@/lib/http";
import { getRepo } from "@/lib/repo";

export const GET = handler(async (_request: NextRequest, ctx: RouteContext<"/api/posts/[id]">) => {
  const { id } = await ctx.params;
  const post = await (await getRepo()).posts.byId(id);
  if (!post) throw new ApiError(404, "Post not found");
  return json(post);
});
