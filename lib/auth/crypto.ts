import "server-only";
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, randomInt } from "node:crypto";
import { authSecret } from "./token";

export { createToken, verifyToken } from "./token";

// ── Access keys & invite tokens ─────────────────────────────────────────
// Access keys are 6-digit numbers. With only 10^6 possible values a plain hash could be reversed by trying
// every number, so the lookup hash is an HMAC keyed with AUTH_SECRET (a leaked database alone doesn't reveal
// keys), and sign-in attempts are rate-limited per IP and globally. A reversible AES-256-GCM copy is kept so
// the owner and admins can view the key again. Changing AUTH_SECRET invalidates every access key.
// Invite tokens are 192 random bits, so a plain SHA-256 is enough for them.

/** Uniformly random 6-digit key, "000000"–"999999". */
export const generateAccessKey = () => randomInt(0, 1_000_000).toString().padStart(6, "0");
export const generateInviteToken = () => randomBytes(24).toString("base64url");
export const ACCESS_KEY_PATTERN = /^\d{6}$/;

/** Accepts "123 456" / "123-456" as typed or pasted. */
export const normalizeAccessKey = (input: string) => input.replace(/[\s-]/g, "");
export const isAccessKeyFormat = (key: string) => ACCESS_KEY_PATTERN.test(key);

export const hashSecret = (secret: string) => createHash("sha256").update(secret.trim()).digest("hex");

export const hashAccessKey = (key: string) => createHmac("sha256", authSecret()).update(`access-key:${key}`).digest("hex");

const cipherKey = () => createHash("sha256").update(`virallens:secrets:${authSecret()}`).digest();

export function encryptSecret(secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", cipherKey(), iv);
  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), encrypted.toString("base64url")].join(".");
}

/** Returns null when the value can't be decrypted (e.g. AUTH_SECRET was rotated). */
export function decryptSecret(value: string | null | undefined): string | null {
  if (!value) return null;
  const [version, iv, tag, data] = value.split(".");
  if (version !== "v1" || !iv || !tag || !data) return null;
  try {
    const decipher = createDecipheriv("aes-256-gcm", cipherKey(), Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
