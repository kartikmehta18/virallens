import "server-only";
import type { NextRequest, NextResponse } from "next/server";
import { env } from "../env";
import { ApiError } from "../http";
import { getRepo } from "../repo";
import type { StoredUser } from "../repo/types";
import type { User } from "../types";
import { createToken, verifyToken } from "./crypto";

export const SESSION_COOKIE = "vl_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

/** Header names the client sends in TEST_MODE (values come from localStorage). */
export const TEST_USER_HEADER = "x-vl-user-id";
export const TEST_NAME_HEADER = "x-vl-user-name";
export const TEST_EMAIL_HEADER = "x-vl-user-email";
const TEST_ID_PATTERN = /^local_[A-Za-z0-9-]{8,64}$/;
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const USERNAME_PATTERN = /^[a-z0-9_.]{3,32}$/;

export const publicUser = (user: StoredUser): User => ({
  id: user.id,
  username: user.username,
  email: user.email,
  name: user.name,
  isTest: user.isTest,
  createdAt: user.createdAt,
});

/**
 * Resolves the current user.
 * - TEST_MODE on: the browser-generated localStorage id is trusted; a user row is created on first sight.
 * - TEST_MODE off: a signed session cookie issued by /api/auth/login is required.
 */
export async function getCurrentUser(request: NextRequest): Promise<User | null> {
  const repo = await getRepo();

  if (env.testMode) {
    const id = request.headers.get(TEST_USER_HEADER);
    if (!id || !TEST_ID_PATTERN.test(id)) return null;
    const existing = await repo.users.byId(id);
    if (existing) return publicUser(existing);
    // The account itself (username, email, password hash) lives in the browser's localStorage; this row
    // mirrors it. Username stays null in the DB and email falls back to a synthetic one if already taken,
    // so local accounts from different browsers never collide on unique columns.
    const name = decodeURIComponent(request.headers.get(TEST_NAME_HEADER) ?? "").slice(0, 64) || "guest";
    const email = decodeURIComponent(request.headers.get(TEST_EMAIL_HEADER) ?? "").toLowerCase();
    const emailFree = EMAIL_PATTERN.test(email) && !(await repo.users.byEmail(email));
    const created = await repo.users.create({
      id,
      username: null,
      email: emailFree ? email : `${id}@local.test`,
      name,
      passwordHash: null,
      isTest: true,
    });
    return publicUser(created);
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? verifyToken(token) : null;
  if (!session) return null;
  const user = await repo.users.byId(session.uid);
  return user ? publicUser(user) : null;
}

export async function requireUser(request: NextRequest): Promise<User> {
  const user = await getCurrentUser(request);
  if (!user) throw new ApiError(401, "Please sign in first");
  return user;
}

export function setSessionCookie(response: NextResponse, userId: string) {
  response.cookies.set(SESSION_COOKIE, createToken({ uid: userId }, SESSION_MAX_AGE), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });
}
