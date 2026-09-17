import { NextResponse, type NextRequest } from "next/server";
import { limitAccessKeyAttempts, limitSignInAttempts, recordFailedAccessKey } from "@/lib/auth/access";
import { hashAccessKey, isAccessKeyFormat, normalizeAccessKey } from "@/lib/auth/crypto";
import { publicUser, setSessionCookie } from "@/lib/auth/session";
import { env } from "@/lib/env";
import { ApiError, handler, readJson } from "@/lib/http";
import { getRepo } from "@/lib/repo";

/**
 * POST /api/auth/login { accessKey } — sign in with an admin-issued 6-digit access key.
 * (Everyone else signs in with Google via /api/auth/google.)
 */
export const POST = handler(async (request: NextRequest) => {
  if (env.testMode) throw new ApiError(400, "Server accounts are disabled in test mode");
  await limitSignInAttempts(request);
  await limitAccessKeyAttempts();

  const body = await readJson<{ accessKey?: string }>(request);
  const accessKey = normalizeAccessKey(typeof body.accessKey === "string" ? body.accessKey : "");
  const repo = await getRepo();
  const user = isAccessKeyFormat(accessKey) ? await repo.users.byAccessKeyHash(hashAccessKey(accessKey)) : null;
  if (!user) {
    await recordFailedAccessKey(request);
    throw new ApiError(401, "That access key isn't valid");
  }
  if (user.disabled) throw new ApiError(403, "This account has been disabled — contact your admin");
  await repo.users.update(user.id, { lastLoginAt: new Date() });

  const response = NextResponse.json({ user: publicUser(user) });
  setSessionCookie(response, user);
  return response;
});
