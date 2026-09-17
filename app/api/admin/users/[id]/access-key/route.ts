import { NextResponse, type NextRequest } from "next/server";
import { issueAccessKey, toAdminUser } from "@/lib/auth/access";
import { requireAdmin, setSessionCookie } from "@/lib/auth/session";
import { ApiError, handler } from "@/lib/http";
import { getRepo } from "@/lib/repo";

/**
 * POST /api/admin/users/[id]/access-key — regenerates the user's access key.
 * The old key stops working immediately and the user is signed out of every device.
 */
export const POST = handler(async (request: NextRequest, ctx: RouteContext<"/api/admin/users/[id]/access-key">) => {
  const admin = await requireAdmin(request);
  const { id } = await ctx.params;
  const repo = await getRepo();
  const target = await repo.users.byId(id);
  if (!target || target.isTest) throw new ApiError(404, "User not found");

  const accessKey = await issueAccessKey(repo, id, true);
  const updated = await repo.users.byId(id);
  const response = NextResponse.json({ user: updated ? toAdminUser(updated) : null, accessKey });
  // Regenerating your own key revokes your sessions too — hand this browser a fresh one.
  if (updated && id === admin.id) setSessionCookie(response, updated);
  return response;
});
