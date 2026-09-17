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

const DEFAULT_INPUT: Record<Platform, (vars: { handle: string; profileUrl: string; limit: number }) => Record<string, unknown>> = {
  x: ({ handle, limit }) => ({ twitterHandles: [handle], maxItems: limit, sort: "Latest" }),
  linkedin: ({ profileUrl, limit }) => ({ targetUrls: [profileUrl], maxPosts: limit }),
  instagram: ({ profileUrl, limit }) => ({ directUrls: [profileUrl], resultsType: "posts", resultsLimit: limit }),
};

/** Scrapes a creator's most recent posts and returns raw actor output. */
export function scrapeCreator(ref: CreatorRef, limit: number): Promise<RawItem[]> {
  const vars = { handle: ref.handle, profileUrl: creatorProfileUrl(ref), limit };
  const input = buildInput(`APIFY_INPUT_${ref.platform.toUpperCase()}_PROFILE`, DEFAULT_INPUT[ref.platform](vars), vars);
  return runActor(PROFILE_ACTORS[ref.platform](), input, limit);
}
