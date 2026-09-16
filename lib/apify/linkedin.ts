import "server-only";
import { topicToHashtag } from "../text";
import { buildInput, runActor, type RawItem } from "./client";

export const LINKEDIN_ACTOR = () => process.env.APIFY_ACTOR_LINKEDIN?.trim() || "harvestapi/linkedin-post-search";

/** Searches LinkedIn posts for a topic and returns raw actor output. */
export function scrapeLinkedIn(topic: string, limit: number, onStart?: (runId: string) => void): Promise<RawItem[]> {
  const input = buildInput(
    "APIFY_INPUT_LINKEDIN",
    { searchQueries: [topic], maxPosts: limit, sortBy: "relevance" },
    { topic, hashtag: topicToHashtag(topic), limit },
  );
  return runActor(LINKEDIN_ACTOR(), input, limit, onStart);
}
