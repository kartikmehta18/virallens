import "server-only";
import { topicToHashtag } from "../text";
import { buildInput, runActor, type RawItem, type ScrapePage } from "./client";

export const X_ACTOR = () => process.env.APIFY_ACTOR_X?.trim() || "apidojo/tweet-scraper";

/** apidojo/tweet-scraper returns nothing below 50 results per query; other actors take the limit as-is. */
export const xLimit = (limit: number) => (X_ACTOR() === "apidojo/tweet-scraper" ? Math.max(limit, 50) : limit);

/**
 * Searches X/Twitter for a topic and returns raw actor output. For "load more", `page.before` asks for
 * top tweets posted before the oldest one already stored, so each click brings older posts instead of
 * paying again for the same top results.
 */
export function scrapeX(topic: string, limit: number, onStart?: (runId: string) => void, page?: ScrapePage): Promise<RawItem[]> {
  const input = {
    ...buildInput(
      "APIFY_INPUT_X",
      { searchTerms: [topic], maxItems: xLimit(limit), sort: "Top", tweetLanguage: "en" },
      { topic, hashtag: topicToHashtag(topic), limit },
    ),
    ...(page?.before && { end: page.before.slice(0, 10) }),
  };
  return runActor(X_ACTOR(), input, xLimit(limit), onStart);
}
