import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getCache } from "@/lib/cache";
import { ApiError, clientIp, handler, json, readJson } from "@/lib/http";
import { simulatePost, type DraftImage } from "@/lib/simulator";
import { normalizeTopic } from "@/lib/text";
import { PLATFORMS } from "@/lib/types";

export const maxDuration = 60;

const MAX_CAPTION = 5000;
/** Decoded bytes; the page downsizes images to ~1280px JPEG before upload, so this is only a guard. */
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const DATA_URL = /^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/]+={0,2})$/;
const HOURLY_LIMIT = 30;
const RESULT_TTL = 60 * 60;

function parseImage(value: unknown): DraftImage | null {
  if (value === undefined || value === null || value === "") return null;
  const match = typeof value === "string" ? DATA_URL.exec(value) : null;
  if (!match) throw new ApiError(400, "Upload a JPG, PNG, WebP or GIF image");
  if ((match[2].length * 3) / 4 > MAX_IMAGE_BYTES) throw new ApiError(413, "That image is too large — use one under 4 MB");
  return { mimeType: match[1] as DraftImage["mimeType"], data: match[2] };
}

/**
 * POST /api/simulate { platform, caption, niche?, image?: data URL } → SimulationResult
 * Scores a draft post against real posts in its niche. Identical drafts are served from cache for an hour.
 */
export const POST = handler(async (request: NextRequest) => {
  const body = await readJson<{ platform?: unknown; caption?: unknown; niche?: unknown; image?: unknown }>(request);
  const platform = PLATFORMS.find((p) => p === body.platform);
  if (!platform) throw new ApiError(400, "Pick a platform");
  const caption = typeof body.caption === "string" ? body.caption.trim().slice(0, MAX_CAPTION) : "";
  if (caption.length < 3) throw new ApiError(400, "Write the caption you plan to post");
  const niche = (typeof body.niche === "string" && normalizeTopic(body.niche).slice(0, 80)) || null;
  const image = parseImage(body.image);

  const cache = await getCache();
  const key = `simulator:result:v1:${createHash("sha256")
    .update(JSON.stringify([platform, niche, caption, image?.data ?? null]))
    .digest("hex")}`;
  const cached = await cache.get(key);
  if (cached) return json(JSON.parse(cached));

  const who = (await getCurrentUser(request))?.id ?? clientIp(request);
  if ((await cache.incr(`ratelimit:simulate:${who}`, 3600)) > HOURLY_LIMIT) {
    throw new ApiError(429, "You've run a lot of simulations this hour — try again later");
  }

  const result = await simulatePost({ platform, caption, niche, image });
  await cache.set(key, JSON.stringify(result), RESULT_TTL);
  return json(result);
});
