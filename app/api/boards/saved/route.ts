import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { handler, json } from "@/lib/http";
import { getRepo } from "@/lib/repo";

/** GET /api/boards/saved — map of postId -> boardIds for the signed-in user (empty when signed out). */
export const GET = handler(async (request: NextRequest) => {
  const user = await getCurrentUser(request);
  return json({ saved: user ? await (await getRepo()).boards.savedMap(user.id) : {} });
});
