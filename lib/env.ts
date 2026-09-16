import "server-only";
import { resolveDbParts } from "./db/url";

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
    const secret = process.env.AUTH_SECRET?.trim();
    if (secret) return secret;
    if (process.env.NODE_ENV === "production" && !this.testMode) {
      throw new Error("AUTH_SECRET must be set when TEST_MODE is off in production");
    }
    return "virallens-dev-secret-do-not-use-in-production";
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
