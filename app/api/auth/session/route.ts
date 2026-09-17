import type { NextRequest } from "next/server";
import { activeAiProvider } from "@/lib/ai/breakdown";
import { getCurrentUser } from "@/lib/auth/session";
import { env } from "@/lib/env";
import { handler, json } from "@/lib/http";
import type { SessionInfo } from "@/lib/types";

export const GET = handler(async (request: NextRequest) => {
  const session: SessionInfo = {
    testMode: env.testMode,
    dbEnabled: env.dbEnabled,
    apifyEnabled: Boolean(env.apifyToken),
    aiProvider: activeAiProvider(),
    user: await getCurrentUser(request),
  };
  return json(session);
});
