import { NextResponse, type NextRequest } from "next/server";
import { inviteStatus, requestOrigin } from "@/lib/auth/access";
import { hashSecret } from "@/lib/auth/crypto";
import { GOOGLE_STATE_COOKIE, createPkce, googleAuthUrl } from "@/lib/auth/google";
import { signData } from "@/lib/auth/token";
import { env } from "@/lib/env";
import { getRepo } from "@/lib/repo";

/** Only same-site relative paths are allowed as post-sign-in destinations. */
const safeNext = (value: string | null | undefined) => (value && value.startsWith("/") && !value.startsWith("//") ? value : "/explore");

/** GET /api/auth/google?next=/explore&invite=<token> — starts "Continue with Google". */
export async function GET(request: NextRequest) {
  const origin = requestOrigin(request);
  const params = request.nextUrl.searchParams;
  if (!env.googleEnabled) return NextResponse.redirect(`${origin}/login?error=google_disabled`);

  const next = safeNext(params.get("next"));
  const invite = params.get("invite")?.trim() || null;

  // Pre-select the invited Google account when the invite is tied to an email.
  let loginHint: string | null = null;
  if (invite) {
    const stored = await (await getRepo()).invites.byTokenHash(hashSecret(invite));
    if (stored && inviteStatus(stored) === "pending") loginHint = stored.email;
  }

  const state = crypto.randomUUID();
  const pkce = createPkce();
  const response = NextResponse.redirect(googleAuthUrl({ origin, state, codeChallenge: pkce.challenge, loginHint }));
  response.cookies.set(GOOGLE_STATE_COOKIE, signData({ state, verifier: pkce.verifier, next, invite }, 10 * 60), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && origin.startsWith("https://"),
    maxAge: 10 * 60,
    path: "/api/auth/google",
  });
  return response;
}
