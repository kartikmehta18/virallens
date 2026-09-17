import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { ApiError, handler, json, readJson } from "@/lib/http";
import { parsePlatforms } from "@/lib/query";
import { getRepo } from "@/lib/repo";
import { normalizeTopic } from "@/lib/text";

export const GET = handler(async (request: NextRequest) => {
  const user = await requireUser(request);
  return json({ items: await (await getRepo()).watches.list(user.id) });
});

/** POST /api/watches { topic, platforms?, thresholdScore? } — creates or updates a watched topic. */
export const POST = handler(async (request: NextRequest) => {
  const user = await requireUser(request);
  const body = await readJson<{ topic?: string; platforms?: string[]; thresholdScore?: number }>(request);
  const topic = normalizeTopic(body.topic ?? "");
  if (topic.length < 2) throw new ApiError(400, "Topic must be at least 2 characters");
  const thresholdScore = Number(body.thresholdScore);

  const watch = await (
    await getRepo()
  ).watches.upsert(user.id, {
    topic,
    platforms: parsePlatforms(body.platforms),
    thresholdScore: Number.isFinite(thresholdScore) && thresholdScore > 0 ? thresholdScore : 50,
  });
  return json(watch, { status: 201 });
});
