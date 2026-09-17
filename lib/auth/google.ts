import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { env } from "../env";

// Google OAuth 2.0 / OpenID Connect (authorization code flow with PKCE), no extra dependencies.

export const GOOGLE_STATE_COOKIE = "vl_google_oauth";
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

export interface GoogleProfile {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
  picture: string | null;
}

/** The callback URL that must be listed under "Authorized redirect URIs" in Google Cloud. */
export const googleRedirectUri = (origin: string) => `${origin}/api/auth/google/callback`;

export function createPkce() {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export function googleAuthUrl(options: { origin: string; state: string; codeChallenge: string; loginHint?: string | null }) {
  const params = new URLSearchParams({
    client_id: env.googleClientId ?? "",
    redirect_uri: googleRedirectUri(options.origin),
    response_type: "code",
    scope: "openid email profile",
    state: options.state,
    code_challenge: options.codeChallenge,
    code_challenge_method: "S256",
    prompt: "select_account",
  });
  if (options.loginHint) params.set("login_hint", options.loginHint);
  return `${AUTH_URL}?${params}`;
}

/**
 * Exchanges the authorization code for tokens and returns the verified profile from the ID token.
 * The ID token comes straight from Google's token endpoint over TLS (not from the browser), so per Google's
 * guidance its claims can be trusted after checking issuer, audience and expiry.
 */
export async function exchangeGoogleCode(options: { code: string; origin: string; codeVerifier: string }): Promise<GoogleProfile> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: options.code,
      client_id: env.googleClientId ?? "",
      client_secret: env.googleClientSecret ?? "",
      redirect_uri: googleRedirectUri(options.origin),
      grant_type: "authorization_code",
      code_verifier: options.codeVerifier,
    }),
  });
  const data = (await res.json().catch(() => ({}))) as { id_token?: string; error?: string; error_description?: string };
  if (!res.ok || !data.id_token) {
    throw new Error(`Google token exchange failed: ${data.error ?? res.status} ${data.error_description ?? ""}`.trim());
  }

  const [, payload] = data.id_token.split(".");
  const claims = JSON.parse(Buffer.from(payload ?? "", "base64url").toString()) as Record<string, unknown>;
  const issuerOk = claims.iss === "https://accounts.google.com" || claims.iss === "accounts.google.com";
  if (!issuerOk || claims.aud !== env.googleClientId || typeof claims.exp !== "number" || claims.exp * 1000 < Date.now()) {
    throw new Error("Google ID token failed validation");
  }
  if (typeof claims.sub !== "string" || typeof claims.email !== "string") throw new Error("Google ID token is missing sub/email");

  return {
    sub: claims.sub,
    email: claims.email.toLowerCase(),
    emailVerified: claims.email_verified === true || claims.email_verified === "true",
    name: typeof claims.name === "string" ? claims.name : null,
    picture: typeof claims.picture === "string" ? claims.picture : null,
  };
}
