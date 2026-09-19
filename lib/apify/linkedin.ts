import "server-only";
import { topicToHashtag } from "../text";
import { buildInput, runActor, type RawItem, type ScrapePage } from "./client";

export const LINKEDIN_ACTOR = () => process.env.APIFY_ACTOR_LINKEDIN?.trim() || "harvestapi/linkedin-post-search";

/**
 * "Load more" slice n for LinkedIn search: newest posts first (a different set from the default
 * relevance order), then further result pages (100 posts each), alternating the two orders.
 */
function linkedInPage(n: number) {
  return n % 2 ? { sortBy: "date", startPage: (n + 1) / 2 } : { sortBy: "relevance", startPage: n / 2 + 1 };
}

/** Searches LinkedIn posts for a topic and returns raw actor output. */
export function scrapeLinkedIn(topic: string, limit: number, onStart?: (runId: string) => void, page?: ScrapePage): Promise<RawItem[]> {
  const input = {
    ...buildInput(
      "APIFY_INPUT_LINKEDIN",
      { searchQueries: [topic], maxPosts: limit, sortBy: "relevance" },
      { topic, hashtag: topicToHashtag(topic), limit },
    ),
    ...(page && linkedInPage(page.index)),
  };
  return runActor(LINKEDIN_ACTOR(), input, limit, onStart);
}
