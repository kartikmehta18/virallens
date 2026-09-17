import "server-only";
import { env } from "../env";
import { getRepo } from "../repo";
import type { StoredUser } from "../repo/types";
import { inviteStatus, issueAccessKey } from "./access";
import { hashSecret } from "./crypto";
import type { GoogleProfile } from "./google";

export type SignInError =
  | "google_disabled"
  | "google_state"
  | "google_cancelled"
  | "google_failed"
  | "google_unverified"
  | "google_mismatch"
  | "not_invited"
  | "invite_invalid"
  | "invite_email_mismatch"
  | "account_disabled";

export class SignInFailure extends Error {
  constructor(public code: SignInError) {
    super(code);
  }
}

/**
 * Finds or creates the account behind a Google profile.
 * Invite-only: an existing server account (matched by Google id, or by verified email for someone an admin
 * added) may sign in; a new account needs a valid invite. ACCESS_MODE=open lets anyone create an account.
 */
export async function resolveGoogleUser(profile: GoogleProfile, inviteToken: string | null): Promise<StoredUser> {
  if (!profile.emailVerified) throw new SignInFailure("google_unverified");
  const repo = await getRepo();

  const byGoogle = await repo.users.byGoogleId(profile.sub);
  const byEmail = byGoogle ? null : await repo.users.byEmail(profile.email);
  // Test-mode mirror rows carry unverified, browser-supplied emails, so they never grant access by themselves.
  const existing = byGoogle ?? (byEmail && !byEmail.isTest ? byEmail : null);

  if (existing) {
    if (existing.disabled) throw new SignInFailure("account_disabled");
    if (existing.googleId && existing.googleId !== profile.sub) throw new SignInFailure("google_mismatch");
    const updated =
      (await repo.users.update(existing.id, {
        googleId: profile.sub,
        avatarUrl: profile.picture ?? existing.avatarUrl,
        ...(!existing.name && profile.name && { name: profile.name }),
        ...(!existing.email && { email: profile.email }),
        lastLoginAt: new Date(),
      })) ?? existing;
    if (!updated.accessKeyHash) await issueAccessKey(repo, updated.id, false);
    return (await repo.users.byId(updated.id)) ?? updated;
  }

  const invite = inviteToken ? await repo.invites.byTokenHash(hashSecret(inviteToken)) : null;
  if (inviteToken && (!invite || inviteStatus(invite) !== "pending")) throw new SignInFailure("invite_invalid");
  if (!invite && env.inviteOnly) throw new SignInFailure("not_invited");
  if (invite?.email && invite.email !== profile.email) throw new SignInFailure("invite_email_mismatch");

  const fields = {
    email: profile.email,
    name: profile.name ?? invite?.name ?? profile.email.split("@")[0],
    avatarUrl: profile.picture,
    googleId: profile.sub,
    isTest: false,
    role: invite?.role ?? ("user" as const),
    invitedById: invite?.createdById ?? null,
  };

  // A leftover test-mode row with this email is converted, instead of colliding on the unique email column.
  const user = byEmail?.isTest
    ? ((await repo.users.update(byEmail.id, { ...fields, lastLoginAt: new Date() })) ?? byEmail)
    : await repo.users.create({ ...fields, username: null, passwordHash: null });

  if (invite && !(await repo.invites.markUsed(invite.id, user.id))) {
    // Lost a race for the same invite.
    if (!byEmail?.isTest) await repo.users.remove(user.id);
    throw new SignInFailure("invite_invalid");
  }
  await repo.users.update(user.id, { lastLoginAt: new Date() });
  if (!user.accessKeyHash) await issueAccessKey(repo, user.id, false);
  return (await repo.users.byId(user.id)) ?? user;
}
