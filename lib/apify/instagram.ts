import "server-only";
import { instagramSearch, parseSearch } from "../search";
import { buildInput, runActor, type RawItem, type ScrapePage } from "./client";

export const INSTAGRAM_ACTOR = () => process.env.APIFY_ACTOR_INSTAGRAM?.trim() || "apify/instagram-hashtag-scraper";

/**
 * Scrapes Instagram posts for a topic. Multi-word topics use the actor's keyword search (as a hashtag,
 * "agentic ai data science" would become #agenticaidatascience); single words and typed #tags stay
 * hashtag searches. Instagram has no paging, so "load more" alternates reels and posts and goes deeper.
 */
export function scrapeInstagram(topic: string, limit: number, onStart?: (runId: string) => void, page?: ScrapePage): Promise<RawItem[]> {
  const { keywordSearch, values } = instagramSearch(parseSearch(topic));
  const depth = page ? Math.min(2 ** Math.floor(page.index / 2), 4) : 1;
  const perValue = Math.ceil((limit * depth) / values.length);
  const input = {
    ...buildInput(
      "APIFY_INPUT_INSTAGRAM",
      { hashtags: values, ...(keywordSearch && { keywordSearch: true }), resultsType: "posts", resultsLimit: perValue },
      { topic, hashtag: values[0] ?? "", limit: perValue },
    ),
    ...(page && { resultsType: page.index % 2 ? "reels" : "posts" }),
  };
  return runActor(INSTAGRAM_ACTOR(), input, perValue * values.length, onStart);
}
