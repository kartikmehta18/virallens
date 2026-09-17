import type { NextRequest } from "next/server";
import { issueAccessKey, toAdminUser } from "@/lib/auth/access";
import { EMAIL_PATTERN, USERNAME_PATTERN, requireAdmin } from "@/lib/auth/session";
import { ApiError, handler, json, readJson } from "@/lib/http";
import { getRepo } from "@/lib/repo";
import { ROLES, type Role } from "@/lib/types";

/** GET /api/admin/users — every server account with its access key. */
export const GET = handler(async (request: NextRequest) => {
  await requireAdmin(request);
  const users = await (await getRepo()).users.list();
  return json({ items: users.map(toAdminUser) });
});

/**
 * POST /api/admin/users { name?, username?, email?, role? }
 * Adds a user who signs in with the generated access key. Email is optional; a name or username is required.
 */
export const POST = handler(async (request: NextRequest) => {
  const admin = await requireAdmin(request);
  const body = await readJson<{ name?: string; username?: string; email?: string; role?: string }>(request);
  const name = body.name?.trim().slice(0, 80) || "";
  const username = body.username?.trim().toLowerCase() || "";
  const email = body.email?.trim().toLowerCase() || "";
  const role: Role = (ROLES as readonly string[]).includes(body.role ?? "") ? (body.role as Role) : "user";

  if (!name && !username) throw new ApiError(400, "Give the user a name or a username");
  if (username && !USERNAME_PATTERN.test(username)) throw new ApiError(400, "Username must be 3–32 characters: letters, numbers, _ or .");
  if (email && !EMAIL_PATTERN.test(email)) throw new ApiError(400, "Enter a valid email address, or leave it empty");

  const repo = await getRepo();
  if (username && (await repo.users.byUsername(username))) throw new ApiError(409, "That username is taken");
  if (email && (await repo.users.byEmail(email))) throw new ApiError(409, "An account with this email already exists");

  const user = await repo.users.create({
    username: username || null,
    email: email || null,
    name: name || username,
    passwordHash: null,
    isTest: false,
    role,
    invitedById: admin.id,
  });
  const accessKey = await issueAccessKey(repo, user.id, false);
  const stored = await repo.users.byId(user.id);
  return json({ user: toAdminUser(stored ?? user), accessKey }, { status: 201 });
});
