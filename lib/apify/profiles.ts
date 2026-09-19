import "server-only";
import { creatorProfileUrl } from "../creators";
import type { CreatorRef, Platform } from "../types";
import { buildInput, runActor, type RawItem } from "./client";

// Creator timelines use profile actors, which differ from the topic-search actors.
// Override with APIFY_ACTOR_<PLATFORM>_PROFILE and APIFY_INPUT_<PLATFORM>_PROFILE
// ({{handle}}, {{profileUrl}} and {{limit}} placeholders).

export const PROFILE_ACTORS: Record<Platform, () => string> = {
  x: () => process.env.APIFY_ACTOR_X_PROFILE?.trim() || "apidojo/tweet-scraper",
  linkedin: () => process.env.APIFY_ACTOR_LINKEDIN_PROFILE?.trim() || "harvestapi/linkedin-profile-posts",
  instagram: () => process.env.APIFY_ACTOR_INSTAGRAM_PROFILE?.trim() || "apify/instagram-scraper",
};

/** apidojo/tweet-scraper returns nothing below 50 results per query. */
const actorLimit = (platform: Platform, limit: number) =>
  platform === "x" && PROFILE_ACTORS.x() === "apidojo/tweet-scraper" ? Math.max(limit, 50) : limit;

const DEFAULT_INPUT: Record<Platform, (vars: { handle: string; profileUrl: string; limit: number }) => Record<string, unknown>> = {
  x: ({ handle, limit }) => ({ twitterHandles: [handle], maxItems: limit, sort: "Latest" }),
  linkedin: ({ profileUrl, limit }) => ({ targetUrls: [profileUrl], maxPosts: limit }),
  instagram: ({ profileUrl, limit }) => ({ directUrls: [profileUrl], resultsType: "posts", resultsLimit: limit }),
};

/**
 * Scrapes a creator's most recent posts and returns raw actor output. `before` (X only — the other
 * profile actors can only filter by "newer than") asks for posts older than that date.
 */
export function scrapeCreator(ref: CreatorRef, limit: number, before?: string | null): Promise<RawItem[]> {
  const max = actorLimit(ref.platform, limit);
  const vars = { handle: ref.handle, profileUrl: creatorProfileUrl(ref), limit: max };
  const input = {
    ...buildInput(`APIFY_INPUT_${ref.platform.toUpperCase()}_PROFILE`, DEFAULT_INPUT[ref.platform](vars), vars),
    ...(ref.platform === "x" && before && { end: before.slice(0, 10) }),
  };
  return runActor(PROFILE_ACTORS[ref.platform](), input, max);
}
