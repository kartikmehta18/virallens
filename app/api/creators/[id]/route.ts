import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { ApiError, handler, json } from "@/lib/http";
import { getRepo } from "@/lib/repo";

/** DELETE /api/creators/[id] — removes a favorite creator (their stored posts stay). */
export const DELETE = handler(async (request: NextRequest, ctx: RouteContext<"/api/creators/[id]">) => {
  const user = await requireUser(request);
  const { id } = await ctx.params;
  if (!(await (await getRepo()).creators.remove(user.id, id))) throw new ApiError(404, "Creator not found");
  return json({ ok: true });
});
