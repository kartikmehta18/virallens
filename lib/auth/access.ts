import "server-only";
import type { NextRequest } from "next/server";
import { getCache } from "../cache";
import { ApiError, clientIp } from "../http";
import type { Repository, StoredInvite, StoredUser } from "../repo/types";
import type { AdminUser, Invite } from "../types";
import { decryptSecret, encryptSecret, generateAccessKey, hashAccessKey } from "./crypto";
import { publicUser } from "./session";

/**
 * Issues a fresh 6-digit access key for a user and returns it in plain text. Keys are unique across users.
 * `revokeSessions` signs the user out everywhere (used when an existing key is regenerated).
 */
export async function issueAccessKey(repo: Repository, userId: string, revokeSessions: boolean): Promise<string> {
  let accessKey = generateAccessKey();
  for (let attempt = 0; await repo.users.byAccessKeyHash(hashAccessKey(accessKey)); attempt++) {
    if (attempt >= 20) throw new ApiError(500, "Couldn't generate a unique access key — try again");
    accessKey = generateAccessKey();
  }
  const updated = await repo.users.update(userId, {
    accessKeyHash: hashAccessKey(accessKey),
    accessKeyCipher: encryptSecret(accessKey),
    accessKeyCreatedAt: new Date(),
    bumpSessionVersion: revokeSessions,
  });
  if (!updated) throw new ApiError(404, "User not found");
  return accessKey;
}

export const revealAccessKey = (user: StoredUser) => decryptSecret(user.accessKeyCipher);

export function toAdminUser(user: StoredUser): AdminUser {
  return {
    ...publicUser(user),
    disabled: user.disabled,
    googleLinked: Boolean(user.googleId),
    accessKey: revealAccessKey(user),
    hasAccessKey: Boolean(user.accessKeyHash),
    accessKeyCreatedAt: user.accessKeyCreatedAt,
    lastLoginAt: user.lastLoginAt,
  };
}

export const inviteStatus = (invite: StoredInvite): Invite["status"] =>
  invite.usedAt ? "used" : new Date(invite.expiresAt).getTime() < Date.now() ? "expired" : "pending";

export const inviteLink = (origin: string, token: string) => `${origin}/login?invite=${encodeURIComponent(token)}`;

export function toInvite(invite: StoredInvite, origin: string): Invite {
  const token = decryptSecret(invite.tokenCipher);
  return {
    id: invite.id,
    email: invite.email,
    name: invite.name,
    role: invite.role,
    status: inviteStatus(invite),
    link: token ? inviteLink(origin, token) : null,
    createdById: invite.createdById,
    expiresAt: invite.expiresAt,
    usedAt: invite.usedAt,
    usedById: invite.usedById,
    createdAt: invite.createdAt,
  };
}

/** Public origin for links: APP_URL when set, otherwise the request's own origin. */
export const requestOrigin = (request: NextRequest) => (process.env.APP_URL?.trim() || request.nextUrl.origin).replace(/\/$/, "");

const failedKey = (request: NextRequest) => `ratelimit:login-failed:${clientIp(request)}`;

/** Blocks an IP after 10 failed sign-ins within 15 minutes (successful sign-ins don't count). */
export async function limitSignInAttempts(request: NextRequest) {
  const failures = Number(await (await getCache()).get(failedKey(request))) || 0;
  if (failures >= 10) throw new ApiError(429, "Too many failed sign-in attempts — try again in 15 minutes");
}

export async function recordFailedSignIn(request: NextRequest) {
  await (await getCache()).incr(failedKey(request), 15 * 60);
}

// 6-digit keys can be guessed from many IPs at once, so failed key attempts are also capped workspace-wide.
const GLOBAL_KEY_FAILURES = "ratelimit:access-key-failed:global";
const GLOBAL_KEY_FAILURE_LIMIT = 100;

export async function limitAccessKeyAttempts() {
  const failures = Number(await (await getCache()).get(GLOBAL_KEY_FAILURES)) || 0;
  if (failures >= GLOBAL_KEY_FAILURE_LIMIT) {
    throw new ApiError(429, "Access-key sign-in is paused after too many failed attempts — try again in 15 minutes or use your password");
  }
}

export async function recordFailedAccessKey(request: NextRequest) {
  await recordFailedSignIn(request);
  await (await getCache()).incr(GLOBAL_KEY_FAILURES, 15 * 60);
}
