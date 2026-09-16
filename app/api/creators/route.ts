import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { creatorKey, parseCreatorInput } from "@/lib/creators";
import { ApiError, handler, json, readJson } from "@/lib/http";
import { getRepo } from "@/lib/repo";
import { PLATFORMS, type FavoriteCreatorWithStats, type Platform } from "@/lib/types";

/** GET /api/creators — the signed-in user's favorite creators with stats from stored posts. */
export const GET = handler(async (request: NextRequest) => {
  const user = await requireUser(request);
  const repo = await getRepo();
  const creators = await repo.creators.list(user.id);
  const stats = await repo.posts.creatorStats(creators);
  const items: FavoriteCreatorWithStats[] = creators.map((creator) => {
    const { name, avatarUrl, ...rest } = stats[creatorKey(creator)];
    // A favorite saved by handle alone shows the real name once posts are stored.
    const displayName =
      creator.name && creator.name.toLowerCase() !== creator.handle ? creator.name : name || creator.name || creator.handle;
    return { ...creator, avatarUrl: creator.avatarUrl ?? avatarUrl, name: displayName, stats: rest };
  });
  return json({ items });
});

/**
 * POST /api/creators { platform, handle, name?, avatarUrl? } — saves a favorite creator.
 * `handle` may also be a profile URL (x.com/…, linkedin.com/in/…, instagram.com/…).
 */
export const POST = handler(async (request: NextRequest) => {
  const user = await requireUser(request);
  const body = await readJson<{ platform?: string; handle?: string; name?: string; avatarUrl?: string }>(request);
  const platform = (PLATFORMS as readonly string[]).includes(body.platform ?? "") ? (body.platform as Platform) : "x";
  const ref = parseCreatorInput(body.handle ?? "", platform);
  if (!ref) throw new ApiError(400, "Enter a valid handle or profile URL");

  const repo = await getRepo();
  const known = (await repo.posts.creatorStats([ref]))[creatorKey(ref)];
  const avatarUrl = typeof body.avatarUrl === "string" && /^https?:\/\//.test(body.avatarUrl) ? body.avatarUrl : known.avatarUrl;
  const creator = await repo.creators.add(user.id, {
    ...ref,
    name: body.name?.trim().slice(0, 255) || known.name || ref.handle,
    avatarUrl,
  });
  return json(creator, { status: 201 });
});
