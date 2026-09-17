import { createHmac, timingSafeEqual } from "node:crypto";

// Session token signing without "server-only" / env imports, so proxy.ts can verify cookies too.

export const SESSION_COOKIE = "vl_session";

export interface SessionToken {
  uid: string;
  /** User.sessionVersion at sign-in; a mismatch means the session was revoked. */
  v: number;
}

const DEV_SECRET = "virallens-dev-secret-do-not-use-in-production";

export function authSecret(): string {
  const secret = process.env.AUTH_SECRET?.trim();
  if (secret) return secret;
  const testMode = ["on", "true", "1", "yes"].includes((process.env.TEST_MODE ?? "").trim().toLowerCase());
  if (process.env.NODE_ENV === "production" && !testMode) {
    throw new Error("AUTH_SECRET must be set when TEST_MODE is off in production");
  }
  return DEV_SECRET;
}

const sign = (payload: string) => createHmac("sha256", authSecret()).update(payload).digest("base64url");

/** Signs any JSON payload with an expiry: base64url(json).signature */
export function signData(data: object, maxAgeSeconds: number): string {
  const payload = Buffer.from(JSON.stringify({ ...data, exp: Math.floor(Date.now() / 1000) + maxAgeSeconds })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

/** Returns the payload of a valid, unexpired value from signData(), otherwise null. */
export function verifyData(token: string | undefined | null): Record<string, unknown> | null {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    return typeof data.exp === "number" && data.exp >= Date.now() / 1000 ? data : null;
  } catch {
    return null;
  }
}

/** Creates a compact signed session token. */
export const createToken = (data: SessionToken, maxAgeSeconds: number) => signData(data, maxAgeSeconds);

export function verifyToken(token: string | undefined | null): SessionToken | null {
  const data = verifyData(token);
  if (!data || typeof data.uid !== "string") return null;
  return { uid: data.uid, v: typeof data.v === "number" ? data.v : 0 };
}
