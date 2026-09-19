import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { parseCreatorKey } from "@/lib/creators";
import { ApiError, clientIp, handler, json, readJson } from "@/lib/http";
import { fetchCreatorPosts } from "@/lib/scrape/creator";

// Apify profile runs can take a minute or two.
export const maxDuration = 300;

/**
 * POST /api/creators/fetch { platform, handle, name?, avatarUrl?, force?, more? } — pulls the creator's latest
 * posts. more: true fetches further back than last time ({ status: "exhausted" } once it can't go deeper).
 */
export const POST = handler(async (request: NextRequest) => {
  const body = await readJson<{ platform?: string; handle?: string; name?: string; avatarUrl?: string; force?: boolean; more?: boolean }>(
    request,
  );
  const ref = parseCreatorKey(`${body.platform ?? ""}:${body.handle ?? ""}`);
  if (!ref) throw new ApiError(400, "Unknown creator");

  const user = await getCurrentUser(request);
  const result = await fetchCreatorPosts({
    ref,
    name: body.name,
    avatarUrl: body.avatarUrl,
    rateKey: user?.id ?? clientIp(request),
    force: Boolean(body.force),
    more: Boolean(body.more),
  });
  return json(result);
});
