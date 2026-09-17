import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { creatorKey, creatorProfileUrl, parseCreatorKey } from "@/lib/creators";
import { ApiError, handler, json } from "@/lib/http";
import { getRepo } from "@/lib/repo";
import type { CreatorProfile } from "@/lib/types";

/** GET /api/creators/profile?platform=x&handle=someone — profile + stats built from stored posts. */
export const GET = handler(async (request: NextRequest) => {
  const params = request.nextUrl.searchParams;
  const ref = parseCreatorKey(`${params.get("platform") ?? ""}:${params.get("handle") ?? ""}`);
  if (!ref) throw new ApiError(400, "Unknown creator");

  const repo = await getRepo();
  const user = await getCurrentUser(request);
  const [stats, favorite] = await Promise.all([
    repo.posts.creatorStats([ref]).then((all) => all[creatorKey(ref)]),
    user ? repo.creators.get(user.id, ref) : null,
  ]);
  const { name, avatarUrl, ...rest } = stats;
  const profile: CreatorProfile = {
    ...ref,
    name: name || favorite?.name || ref.handle,
    avatarUrl: avatarUrl || favorite?.avatarUrl || null,
    profileUrl: creatorProfileUrl(ref),
    stats: rest,
    favorite,
  };
  return json(profile);
});
