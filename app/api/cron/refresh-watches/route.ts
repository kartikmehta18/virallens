import type { NextRequest } from "next/server";
import { env } from "@/lib/env";
import { ApiError, handler, json } from "@/lib/http";
import { refreshWatchedTopics } from "@/lib/watch";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

/**
 * GET /api/cron/refresh-watches — invoked by Vercel Cron (see vercel.json) or any scheduler.
 * Requires `Authorization: Bearer $CRON_SECRET` when CRON_SECRET is set (always required in production).
 */
export const GET = handler(async (request: NextRequest) => {
  const secret = env.cronSecret;
  if (secret ? request.headers.get("authorization") !== `Bearer ${secret}` : process.env.NODE_ENV === "production") {
    throw new ApiError(401, "Unauthorized");
  }
  return json(await refreshWatchedTopics());
});
