import "server-only";
import { demoCreatorTopic, generateDemoPosts } from "../apify/demo";
import { NORMALIZERS } from "../apify/normalize";
import { scrapeCreator } from "../apify/profiles";
import { getCache } from "../cache";
import { creatorKey } from "../creators";
import { env } from "../env";
import { ApiError } from "../http";
import { getRepo } from "../repo";
import type { CreatorRef, PostInput } from "../types";

export interface CreatorFetchResult {
  status: "fetched" | "cached";
  postsFound: number;
  source: "apify" | "demo";
}

/**
 * Pulls a creator's latest posts (Apify profile actors, or deterministic demo posts without a token) and
 * stores them. Results stay fresh for SCRAPE_CACHE_TTL unless `force` is set.
 */
export async function fetchCreatorPosts(options: {
  ref: CreatorRef;
  name?: string | null;
  avatarUrl?: string | null;
  rateKey: string;
  force?: boolean;
}): Promise<CreatorFetchResult> {
  const { ref } = options;
  const cache = await getCache();
  const repo = await getRepo();
  const source = env.apifyToken ? "apify" : "demo";
  const freshKey = `creator:fresh:${creatorKey(ref)}`;

  if (!options.force && (await cache.get(freshKey))) return { status: "cached", postsFound: 0, source };

  const used = await cache.incr(`ratelimit:scrape:${options.rateKey}`, 3600);
  if (used > env.scrapeRateLimit) throw new ApiError(429, "Fetch limit reached — try again later");

  // Existing posts tell us the creator's display name, avatar and usual niche.
  const known = (await repo.posts.creatorStats([ref]))[creatorKey(ref)];
  const name = options.name?.trim() || known?.name || ref.handle;
  const avatarUrl = options.avatarUrl || known?.avatarUrl || null;
  const limit = env.apifyMaxItems;

  let inputs: PostInput[];
  if (source === "demo") {
    await new Promise((resolve) => setTimeout(resolve, 900));
    const recent = await repo.posts.search({ creators: [ref], sort: ["newest"], page: 1, limit: 1 });
    const topic = recent.items[0]?.topic ?? demoCreatorTopic(ref.handle);
    inputs = generateDemoPosts(topic, ref.platform, Math.min(limit, 12), { handle: ref.handle, name, avatarUrl });
  } else {
    const raw = await scrapeCreator(ref, limit);
    inputs = raw
      .map((item) => NORMALIZERS[ref.platform](item, `@${ref.handle}`))
      .filter((post): post is PostInput => post !== null)
      // Profile actors can include reposts; keep the creator's own posts.
      .filter((post) => post.authorHandle.toLowerCase() === ref.handle.toLowerCase());
  }

  const saved = await repo.posts.upsertMany(inputs);
  const fresh = saved.length ? (await repo.posts.creatorStats([ref]))[creatorKey(ref)] : null;
  await repo.creators.markFetched(ref, new Date(), { name: fresh?.name ?? null, avatarUrl: fresh?.avatarUrl ?? null });
  await cache.set(freshKey, "1", env.scrapeCacheTtl);
  return { status: "fetched", postsFound: saved.length, source };
}
