import { NextResponse, type NextRequest } from "next/server";
import { hashPassword } from "@/lib/auth/crypto";
import { EMAIL_PATTERN, USERNAME_PATTERN, publicUser, setSessionCookie } from "@/lib/auth/session";
import { env } from "@/lib/env";
import { ApiError, handler, readJson } from "@/lib/http";
import { getRepo } from "@/lib/repo";

/** POST /api/auth/register { username, email, password, name? } */
export const POST = handler(async (request: NextRequest) => {
  if (env.testMode) throw new ApiError(400, "Server accounts are disabled in test mode");
  const body = await readJson<{ username?: string; email?: string; password?: string; name?: string }>(request);
  const username = body.username?.trim().toLowerCase() ?? "";
  const email = body.email?.trim().toLowerCase() ?? "";
  const password = body.password ?? "";

  if (!USERNAME_PATTERN.test(username)) throw new ApiError(400, "Username must be 3–32 characters: letters, numbers, _ or .");
  if (!EMAIL_PATTERN.test(email)) throw new ApiError(400, "Enter a valid email address");
  if (password.length < 8) throw new ApiError(400, "Password must be at least 8 characters");

  const repo = await getRepo();
  if (await repo.users.byUsername(username)) throw new ApiError(409, "That username is taken");
  if (await repo.users.byEmail(email)) throw new ApiError(409, "An account with this email already exists");

  const user = await repo.users.create({
    username,
    email,
    name: body.name?.trim().slice(0, 80) || username,
    passwordHash: await hashPassword(password),
    isTest: false,
  });

  const response = NextResponse.json({ user: publicUser(user) }, { status: 201 });
  setSessionCookie(response, user.id);
  return response;
});
