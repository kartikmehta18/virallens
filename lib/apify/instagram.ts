import "server-only";
import { topicToHashtag } from "../text";
import { buildInput, runActor, type RawItem } from "./client";

export const INSTAGRAM_ACTOR = () => process.env.APIFY_ACTOR_INSTAGRAM?.trim() || "apify/instagram-hashtag-scraper";

/** Scrapes Instagram posts for the topic's hashtag and returns raw actor output. */
export function scrapeInstagram(topic: string, limit: number, onStart?: (runId: string) => void): Promise<RawItem[]> {
  const hashtag = topicToHashtag(topic);
  const input = buildInput(
    "APIFY_INPUT_INSTAGRAM",
    { hashtags: [hashtag], resultsType: "posts", resultsLimit: limit },
    { topic, hashtag, limit },
  );
  return runActor(INSTAGRAM_ACTOR(), input, limit, onStart);
}
