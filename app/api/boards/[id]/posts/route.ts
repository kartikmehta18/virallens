import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { ApiError, handler, json, readJson } from "@/lib/http";
import { getRepo } from "@/lib/repo";

/** POST /api/boards/[id]/posts { postId } — saves a post into a board. */
export const POST = handler(async (request: NextRequest, ctx: RouteContext<"/api/boards/[id]/posts">) => {
  const user = await requireUser(request);
  const { id } = await ctx.params;
  const { postId } = await readJson<{ postId?: string }>(request);
  if (!postId) throw new ApiError(400, "postId is required");
  if (!(await (await getRepo()).boards.addPost(user.id, id, postId))) throw new ApiError(404, "Board or post not found");
  return json({ ok: true }, { status: 201 });
});
