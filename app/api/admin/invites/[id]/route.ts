import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { ApiError, handler, json } from "@/lib/http";
import { getRepo } from "@/lib/repo";

/** DELETE /api/admin/invites/[id] — revokes an invite link. */
export const DELETE = handler(async (request: NextRequest, ctx: RouteContext<"/api/admin/invites/[id]">) => {
  await requireAdmin(request);
  const { id } = await ctx.params;
  if (!(await (await getRepo()).invites.remove(id))) throw new ApiError(404, "Invite not found");
  return json({ ok: true });
});
