import { NextResponse, type NextRequest } from "next/server";
import { verifyPassword } from "@/lib/auth/crypto";
import { publicUser, setSessionCookie } from "@/lib/auth/session";
import { env } from "@/lib/env";
import { ApiError, handler, readJson } from "@/lib/http";
import { getRepo } from "@/lib/repo";

/** POST /api/auth/login { identifier (username or email), password } */
export const POST = handler(async (request: NextRequest) => {
  if (env.testMode) throw new ApiError(400, "Server accounts are disabled in test mode");
  const body = await readJson<{ identifier?: string; email?: string; password?: string }>(request);
  const identifier = (body.identifier ?? body.email ?? "").trim();
  const repo = await getRepo();
  const user = !identifier
    ? null
    : identifier.includes("@")
      ? await repo.users.byEmail(identifier)
      : await repo.users.byUsername(identifier);

  if (!user?.passwordHash || !body.password || !(await verifyPassword(body.password, user.passwordHash))) {
    throw new ApiError(401, "Incorrect username/email or password");
  }

  const response = NextResponse.json({ user: publicUser(user) });
  setSessionCookie(response, user.id);
  return response;
});
