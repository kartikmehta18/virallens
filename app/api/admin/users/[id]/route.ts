import type { NextRequest } from "next/server";
import { toAdminUser } from "@/lib/auth/access";
import { EMAIL_PATTERN, requireAdmin } from "@/lib/auth/session";
import { ApiError, handler, json, readJson } from "@/lib/http";
import { getRepo } from "@/lib/repo";
import type { UserPatch } from "@/lib/repo/types";
import { ROLES, type Role } from "@/lib/types";

/** PATCH /api/admin/users/[id] { role?, disabled?, name?, email? } */
export const PATCH = handler(async (request: NextRequest, ctx: RouteContext<"/api/admin/users/[id]">) => {
  const admin = await requireAdmin(request);
  const { id } = await ctx.params;
  const body = await readJson<{ role?: string; disabled?: boolean; name?: string; email?: string | null }>(request);
  const repo = await getRepo();
  const target = await repo.users.byId(id);
  if (!target || target.isTest) throw new ApiError(404, "User not found");

  const patch: UserPatch = {};
  if (body.role !== undefined) {
    if (!(ROLES as readonly string[]).includes(body.role)) throw new ApiError(400, "Unknown role");
    patch.role = body.role as Role;
  }
  if (body.disabled !== undefined) {
    patch.disabled = Boolean(body.disabled);
    // Disabling signs the user out everywhere.
    if (patch.disabled) patch.bumpSessionVersion = true;
  }
  if (body.name !== undefined) patch.name = body.name.trim().slice(0, 80) || target.username || target.name;
  if (body.email !== undefined) {
    const email = body.email?.trim().toLowerCase() || null;
    if (email && !EMAIL_PATTERN.test(email)) throw new ApiError(400, "Enter a valid email address, or leave it empty");
    if (email && email !== target.email && (await repo.users.byEmail(email))) throw new ApiError(409, "That email is already in use");
    patch.email = email;
  }

  // Never lock the workspace out: an admin can't demote/disable themselves, and one active admin must remain.
  const losesAdmin = target.role === "admin" && !target.disabled && (patch.role === "user" || patch.disabled === true);
  if (losesAdmin && target.id === admin.id) throw new ApiError(400, "You can't remove your own admin access");
  if (losesAdmin && (await repo.users.countAdmins()) <= 1) throw new ApiError(400, "At least one active admin is required");

  const updated = await repo.users.update(id, patch);
  if (!updated) throw new ApiError(404, "User not found");
  return json({ user: toAdminUser(updated) });
});

/** DELETE /api/admin/users/[id] — removes the account and everything it owns. */
export const DELETE = handler(async (request: NextRequest, ctx: RouteContext<"/api/admin/users/[id]">) => {
  const admin = await requireAdmin(request);
  const { id } = await ctx.params;
  if (id === admin.id) throw new ApiError(400, "You can't delete your own account");
  const repo = await getRepo();
  const target = await repo.users.byId(id);
  if (!target || target.isTest) throw new ApiError(404, "User not found");
  if (target.role === "admin" && !target.disabled && (await repo.users.countAdmins()) <= 1) {
    throw new ApiError(400, "At least one active admin is required");
  }
  await repo.users.remove(id);
  return json({ ok: true });
});
