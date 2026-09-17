import type { NextRequest } from "next/server";
import { inviteLink, requestOrigin, toInvite } from "@/lib/auth/access";
import { encryptSecret, generateInviteToken, hashSecret } from "@/lib/auth/crypto";
import { EMAIL_PATTERN, requireAdmin } from "@/lib/auth/session";
import { ApiError, handler, json, readJson } from "@/lib/http";
import { getRepo } from "@/lib/repo";
import { ROLES, type Role } from "@/lib/types";

/** GET /api/admin/invites — every invite link with its status. */
export const GET = handler(async (request: NextRequest) => {
  await requireAdmin(request);
  const invites = await (await getRepo()).invites.list();
  const origin = requestOrigin(request);
  return json({ items: invites.map((invite) => toInvite(invite, origin)) });
});

/** POST /api/admin/invites { email?, name?, role?, expiresInDays? } — creates a single-use sign-up link. */
export const POST = handler(async (request: NextRequest) => {
  const admin = await requireAdmin(request);
  const body = await readJson<{ email?: string; name?: string; role?: string; expiresInDays?: number }>(request);
  const email = body.email?.trim().toLowerCase() || null;
  if (email && !EMAIL_PATTERN.test(email)) throw new ApiError(400, "Enter a valid email address, or leave it empty");
  const role: Role = (ROLES as readonly string[]).includes(body.role ?? "") ? (body.role as Role) : "user";
  const days = Math.min(30, Math.max(1, Math.round(Number(body.expiresInDays) || 7)));

  const repo = await getRepo();
  if (email && (await repo.users.byEmail(email))) throw new ApiError(409, "An account with this email already exists");

  const token = generateInviteToken();
  const invite = await repo.invites.create({
    tokenHash: hashSecret(token),
    tokenCipher: encryptSecret(token),
    email,
    name: body.name?.trim().slice(0, 80) || null,
    role,
    createdById: admin.id,
    expiresAt: new Date(Date.now() + days * 86_400_000).toISOString(),
  });
  const origin = requestOrigin(request);
  return json({ invite: toInvite(invite, origin), link: inviteLink(origin, token) }, { status: 201 });
});
