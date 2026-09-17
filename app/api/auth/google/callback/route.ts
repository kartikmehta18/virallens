import { NextResponse, type NextRequest } from "next/server";
import { requestOrigin } from "@/lib/auth/access";
import { GOOGLE_STATE_COOKIE, exchangeGoogleCode } from "@/lib/auth/google";
import { SignInFailure, resolveGoogleUser, type SignInError } from "@/lib/auth/google-signin";
import { setSessionCookie } from "@/lib/auth/session";
import { verifyData } from "@/lib/auth/token";
import { env } from "@/lib/env";

/** GET /api/auth/google/callback — Google redirects here with ?code&state. */
export async function GET(request: NextRequest) {
  const origin = requestOrigin(request);
  const params = request.nextUrl.searchParams;
  const saved = verifyData(request.cookies.get(GOOGLE_STATE_COOKIE)?.value);

  const fail = (code: SignInError) => {
    const url = new URL(`${origin}/login`);
    url.searchParams.set("error", code);
    if (typeof saved?.invite === "string") url.searchParams.set("invite", saved.invite);
    const response = NextResponse.redirect(url);
    response.cookies.delete({ name: GOOGLE_STATE_COOKIE, path: "/api/auth/google" });
    return response;
  };

  if (!env.googleEnabled) return fail("google_disabled");
  if (params.get("error")) return fail("google_cancelled");
  if (!saved || typeof saved.state !== "string" || saved.state !== params.get("state") || typeof saved.verifier !== "string") {
    return fail("google_state");
  }
  const code = params.get("code");
  if (!code) return fail("google_failed");

  try {
    const profile = await exchangeGoogleCode({ code, origin, codeVerifier: saved.verifier });
    const user = await resolveGoogleUser(profile, typeof saved.invite === "string" ? saved.invite : null);

    const response = NextResponse.redirect(`${origin}${typeof saved.next === "string" ? saved.next : "/explore"}`);
    response.cookies.delete({ name: GOOGLE_STATE_COOKIE, path: "/api/auth/google" });
    setSessionCookie(response, user);
    return response;
  } catch (error) {
    if (error instanceof SignInFailure) return fail(error.code);
    console.error("[virallens] Google sign-in failed:", error);
    return fail("google_failed");
  }
}
