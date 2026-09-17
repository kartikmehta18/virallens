import "server-only";
import { resolveDbParts } from "./db/url";
import { authSecret } from "./auth/token";

const truthy = (value: string | undefined) => ["on", "true", "1", "yes"].includes((value ?? "").trim().toLowerCase());

/** Runtime feature flags derived from environment variables. Read lazily so values are never baked in at build. */
export const env = {
  get testMode() {
    return truthy(process.env.TEST_MODE);
  },
  get dbEnabled() {
    return resolveDbParts() !== null;
  },
  get apifyToken() {
    return process.env.APIFY_API_TOKEN?.trim() || null;
  },
  get redisUrl() {
    return process.env.REDIS_URL?.trim() || null;
  },
  get authSecret() {
    return authSecret();
  },
  /** ACCESS_MODE=invite (default) or open. */
  get accessMode(): "invite" | "open" {
    return process.env.ACCESS_MODE?.trim().toLowerCase() === "open" ? "open" : "invite";
  },
  /**
   * Invite-only access: server accounts (TEST_MODE off) + a database + ACCESS_MODE=invite. Only admins can add
   * users (access keys) or send invite links; every app page and API requires a signed-in user.
   */
  get inviteOnly() {
    return !this.testMode && this.dbEnabled && this.accessMode === "invite";
  },
  get anthropicKey() {
    return process.env.ANTHROPIC_API_KEY?.trim() || null;
  },
  get openaiKey() {
    return process.env.OPENAI_API_KEY?.trim() || null;
  },
  /** Google Gemini (free tier via Google AI Studio). GEMNI_API_KEY is accepted as a typo-tolerant alias. */
  get geminiKey() {
    return (process.env.GEMINI_API_KEY || process.env.GEMNI_API_KEY || process.env.GOOGLE_API_KEY)?.trim() || null;
  },
  get googleClientId() {
    return process.env.GOOGLE_CLIENT_ID?.trim() || null;
  },
  get googleClientSecret() {
    return process.env.GOOGLE_CLIENT_SECRET?.trim() || null;
  },
  /** Google sign-in needs both OAuth credentials and server accounts (TEST_MODE off + database). */
  get googleEnabled() {
    return Boolean(this.googleClientId && this.googleClientSecret && !this.testMode && this.dbEnabled);
  },
  get resendKey() {
    return process.env.RESEND_API_KEY?.trim() || null;
  },
  get cronSecret() {
    return process.env.CRON_SECRET?.trim() || null;
  },
  get appUrl() {
    return (process.env.APP_URL?.trim() || "http://localhost:3000").replace(/\/$/, "");
  },
  get alertFrom() {
    return process.env.ALERT_FROM_EMAIL?.trim() || "ViralLens <alerts@example.com>";
  },
  get scrapeCacheTtl() {
    return Number(process.env.SCRAPE_CACHE_TTL) || 6 * 60 * 60;
  },
  get scrapeRateLimit() {
    return Number(process.env.SCRAPE_RATE_LIMIT) || 20;
  },
  get apifyMaxItems() {
    return Math.min(Math.max(Number(process.env.APIFY_MAX_ITEMS) || 40, 1), 500);
  },
};
