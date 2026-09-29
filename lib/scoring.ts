import { memeScore } from "./meme";
import { PLATFORMS, type MediaType, type Platform } from "./types";

interface Counts {
  likeCount: number;
  commentCount: number;
  shareCount: number;
  viewCount: number | null;
}

/** Weighted cross-platform engagement (spec §6). */
export function engagementScore({ likeCount, commentCount, shareCount, viewCount }: Counts): number {
  return likeCount * 1 + commentCount * 3 + shareCount * 5 + (viewCount ?? 0) * 0.05;
}

/** Hacker-News-style gravity: higher decays faster. (hours + 2)^1.5 halves a post's score in its first ~1.5h. */
export const TRENDING_GRAVITY = 1.5;

/**
 * Cross-platform normalization. Raw engagement isn't comparable between platforms — X counts views,
 * Instagram audiences are far larger than LinkedIn's — so each platform's engagement is scaled by
 * `global typical / platform typical` ("typical" = geometric mean of recent posts, robust to outliers).
 * A post that does well *for its platform* ranks with the best of the others, and the overall scale is
 * unchanged, so watch thresholds keep their meaning. 1 everywhere until enough posts are stored.
 */
export type PlatformFactors = Record<Platform, number>;

export const NEUTRAL_FACTORS: PlatformFactors = Object.fromEntries(PLATFORMS.map((p) => [p, 1])) as PlatformFactors;

/** Fewer recent posts than this on a platform and its baseline is too noisy to use. */
const MIN_SAMPLE = 20;
// Wide on purpose: X counts views, so its typical engagement runs ~100× LinkedIn's. MIN_SAMPLE guards noise.
const MIN_FACTOR = 0.01;
const MAX_FACTOR = 20;

/** Builds factors from per-platform {typical (geometric mean) engagement, sample size}. */
export function platformFactors(stats: Partial<Record<Platform, { typical: number; n: number }>>): PlatformFactors {
  const usable = PLATFORMS.filter((p) => (stats[p]?.n ?? 0) >= MIN_SAMPLE && (stats[p]?.typical ?? 0) > 0);
  if (usable.length < 2) return { ...NEUTRAL_FACTORS };
  // Weighted geometric mean of the platform baselines = the typical post overall.
  const total = usable.reduce((sum, p) => sum + stats[p]!.n, 0);
  const global = Math.exp(usable.reduce((sum, p) => sum + (stats[p]!.n / total) * Math.log(stats[p]!.typical), 0));
  const factors = { ...NEUTRAL_FACTORS };
  for (const p of usable) factors[p] = round(Math.min(MAX_FACTOR, Math.max(MIN_FACTOR, global / stats[p]!.typical)));
  return factors;
}

// Latest factors, refreshed by the repository whenever it re-scores (see refreshTrending).
let currentFactors: PlatformFactors = { ...NEUTRAL_FACTORS };
export const getPlatformFactors = () => currentFactors;
export const setPlatformFactors = (factors: PlatformFactors) => {
  currentFactors = factors;
};

/**
 * Time-decayed, platform-normalized virality: normalized engagement / (hours + 2)^gravity, like HN / Reddit
 * "hot". It depends on the current time, so stored values are refreshed regularly (refreshTrending).
 */
export function trendingScore(
  engagement: number,
  publishedAt: Date | string,
  platform?: Platform,
  now = Date.now(),
  factors: PlatformFactors = currentFactors,
): number {
  const hours = Math.max(0, (now - new Date(publishedAt).getTime()) / 3_600_000);
  const factor = platform ? (factors[platform] ?? 1) : 1;
  return (engagement * factor) / Math.pow(hours + 2, TRENDING_GRAVITY);
}

/** Every derived score for a post — kept together so both repository backends stay in sync. */
export function scorePost<
  T extends Counts & { platform: Platform; publishedAt: string; caption: string; tags: string[]; mediaType: MediaType },
>(post: T, now = Date.now()) {
  const engagement = engagementScore(post);
  return {
    engagementScore: round(engagement),
    trendingScore: round(trendingScore(engagement, post.publishedAt, post.platform, now)),
    memeScore: memeScore(post),
  };
}

/** How often stored trending scores are brought up to date (on the next search after this). */
export const TRENDING_REFRESH_MS = 10 * 60_000;

const round = (n: number) => Math.round(n * 1000) / 1000;
