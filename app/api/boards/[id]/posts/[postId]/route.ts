import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { ApiError, handler, json } from "@/lib/http";
import { getRepo } from "@/lib/repo";

export const DELETE = handler(async (request: NextRequest, ctx: RouteContext<"/api/boards/[id]/posts/[postId]">) => {
  const user = await requireUser(request);
  const { id, postId } = await ctx.params;
  if (!(await (await getRepo()).boards.removePost(user.id, id, postId))) throw new ApiError(404, "Board not found");
  return json({ ok: true });
});
