import type { NextRequest } from "next/server";
import { inviteStatus } from "@/lib/auth/access";
import { hashSecret } from "@/lib/auth/crypto";
import { ApiError, handler, json } from "@/lib/http";
import { getRepo } from "@/lib/repo";

/** GET /api/auth/invite?token= — public details of an invite link, used to pre-fill the sign-up form. */
export const GET = handler(async (request: NextRequest) => {
  const token = request.nextUrl.searchParams.get("token")?.trim();
  if (!token) throw new ApiError(400, "Missing invite token");
  const invite = await (await getRepo()).invites.byTokenHash(hashSecret(token));
  if (!invite) throw new ApiError(404, "This invite link isn't valid");
  const status = inviteStatus(invite);
  if (status !== "pending")
    throw new ApiError(410, status === "used" ? "This invite link has already been used" : "This invite link has expired");
  return json({ email: invite.email, name: invite.name, role: invite.role, expiresAt: invite.expiresAt });
});
