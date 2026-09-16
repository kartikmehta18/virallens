import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { ApiError, handler, json } from "@/lib/http";
import { getRepo } from "@/lib/repo";

export const DELETE = handler(async (request: NextRequest, ctx: RouteContext<"/api/watches/[id]">) => {
  const user = await requireUser(request);
  const { id } = await ctx.params;
  if (!(await (await getRepo()).watches.remove(user.id, id))) throw new ApiError(404, "Watch not found");
  return json({ ok: true });
});
