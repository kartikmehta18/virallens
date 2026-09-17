import "server-only";
import { topicToHashtag } from "../text";
import { buildInput, runActor, type RawItem } from "./client";

export const X_ACTOR = () => process.env.APIFY_ACTOR_X?.trim() || "apidojo/tweet-scraper";

/** Searches X/Twitter for a topic and returns raw actor output. */
export function scrapeX(topic: string, limit: number, onStart?: (runId: string) => void): Promise<RawItem[]> {
  const input = buildInput(
    "APIFY_INPUT_X",
    { searchTerms: [topic], maxItems: limit, sort: "Top", tweetLanguage: "en" },
    { topic, hashtag: topicToHashtag(topic), limit },
  );
  return runActor(X_ACTOR(), input, limit, onStart);
}
