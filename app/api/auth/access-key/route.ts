import type { NextRequest } from "next/server";
import { revealAccessKey } from "@/lib/auth/access";
import { requireUser } from "@/lib/auth/session";
import { env } from "@/lib/env";
import { ApiError, handler, json } from "@/lib/http";
import { getRepo } from "@/lib/repo";

/** GET /api/auth/access-key — the signed-in user's own access key (server accounts only). */
export const GET = handler(async (request: NextRequest) => {
  if (env.testMode) throw new ApiError(400, "Access keys need TEST_MODE=off (server accounts)");
  const { id } = await requireUser(request);
  const user = await (await getRepo()).users.byId(id);
  if (!user) throw new ApiError(404, "User not found");
  return json({
    accessKey: revealAccessKey(user),
    hasAccessKey: Boolean(user.accessKeyHash),
    createdAt: user.accessKeyCreatedAt,
  });
});
