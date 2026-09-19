import "server-only";
import { getCache } from "../cache";
import type { RawItem } from "../apify/client";
import { generateDemoPosts } from "../apify/demo";
import { scrapeInstagram } from "../apify/instagram";
import { scrapeLinkedIn } from "../apify/linkedin";
import { NORMALIZERS } from "../apify/normalize";
import { scrapeX } from "../apify/x";
import { env } from "../env";
import { ApiError } from "../http";
import { getRepo } from "../repo";
import { normalizeTopic } from "../text";
import type { Platform, Post, PostInput, ScrapeJob, ScrapeRunInfo } from "../types";

const SCRAPERS: Record<Platform, (topic: string, limit: number, onStart?: (runId: string) => void) => Promise<RawItem[]>> = {
  x: scrapeX,
  linkedin: scrapeLinkedIn,
  instagram: scrapeInstagram,
};

const freshKey = (platform: Platform, topic: string) => `scrape:fresh:${platform}:${topic.toLowerCase()}`;
const inflightKey = (platforms: Platform[], topic: string) => `scrape:inflight:${[...platforms].sort().join(",")}:${topic.toLowerCase()}`;
/** How deep (results per platform) "load more" has already scraped a topic. */
const depthKey = (platform: Platform, topic: string) => `scrape:depth:${platform}:${topic.toLowerCase()}`;
const DEPTH_TTL = 7 * 24 * 60 * 60;

/** "Load more" doubles the depth each time, up to 4× APIFY_MAX_ITEMS (and never past the 500 hard cap). */
const maxDepth = () => Math.min(env.apifyMaxItems * 4, 500);

export type ScrapeRequestResult =
  | { status: "cached"; platforms: Platform[] }
  | { status: "exhausted"; platforms: Platform[]; limit: number }
  | { status: "started" | "inflight"; job: ScrapeJob };

/**
 * Decides whether a topic needs a fresh scrape. Returns "cached" if every platform was scraped
 * within SCRAPE_CACHE_TTL, otherwise creates a job (the caller runs it in the background).
 *
 * `more` is "load more": actors return their top N results, so re-running at the same N finds nothing
 * new. Instead it re-scrapes deeper (double the previous depth) — the new posts are the ones past the
 * old cut-off. Returns "exhausted" once every platform is at the maximum depth.
 */
export async function requestScrape(options: {
  topic: string;
  platforms: Platform[];
  userId: string | null;
  rateKey: string;
  force?: boolean;
  more?: boolean;
}): Promise<ScrapeRequestResult> {
  const topic = normalizeTopic(options.topic);
  if (topic.length < 2) throw new ApiError(400, "Topic must be at least 2 characters");
  const cache = await getCache();
  const repo = await getRepo();

  const limits = new Map<Platform, number>();
  if (options.more) {
    for (const platform of options.platforms) {
      const depth = Number(await cache.get(depthKey(platform, topic))) || env.apifyMaxItems;
      if (depth < maxDepth()) limits.set(platform, Math.min(depth * 2, maxDepth()));
    }
    if (!limits.size) return { status: "exhausted", platforms: options.platforms, limit: maxDepth() };
  }

  const stale: Platform[] = [];
  for (const platform of options.platforms) {
    if (options.more ? limits.has(platform) : options.force || !(await cache.get(freshKey(platform, topic)))) stale.push(platform);
  }
  if (!stale.length) return { status: "cached", platforms: options.platforms };

  const existingJobId = await cache.get(inflightKey(stale, topic));
  if (existingJobId) {
    const job = await repo.jobs.get(existingJobId);
    if (job && (job.status === "queued" || job.status === "running")) return { status: "inflight", job };
  }

  const used = await cache.incr(`ratelimit:scrape:${options.rateKey}`, 3600);
  if (used > env.scrapeRateLimit) throw new ApiError(429, "Scrape limit reached — try again later");

  const source = env.apifyToken ? "apify" : "demo";
  const job = await repo.jobs.create({
    topic,
    platforms: stale,
    userId: options.userId,
    runs: stale.map((platform) => ({ platform, source, status: "pending", ...(limits.has(platform) && { limit: limits.get(platform) }) })),
  });
  await cache.set(inflightKey(stale, topic), job.id, 15 * 60);
  // Claim the new depth now, so a second click while this job runs goes deeper still instead of repeating it.
  for (const [platform, limit] of limits) await cache.set(depthKey(platform, topic), String(limit), DEPTH_TTL);
  return { status: "started", job };
}

async function fetchPlatform(platform: Platform, topic: string, limit: number, onStart: (runId: string) => void): Promise<PostInput[]> {
  if (!env.apifyToken) {
    await new Promise((resolve) => setTimeout(resolve, 1200 + Math.random() * 1500));
    // Demo posts are seeded, so a deeper "load more" returns the same first posts plus new ones.
    return generateDemoPosts(topic, platform, Math.round(18 * Math.min(limit / env.apifyMaxItems, 4)));
  }
  const raw = await SCRAPERS[platform](topic, limit, onStart);
  return raw.map((item) => NORMALIZERS[platform](item, topic)).filter((post): post is PostInput => post !== null);
}

/** Runs every platform of a job in parallel, storing results as each one completes. */
export async function executeScrapeJob(jobId: string): Promise<Post[]> {
  const repo = await getRepo();
  const cache = await getCache();
  const job = await repo.jobs.get(jobId);
  if (!job) throw new Error(`Scrape job ${jobId} not found`);

  const runs: ScrapeRunInfo[] = job.runs;
  const persistRuns = () => repo.jobs.update(jobId, { runs });
  await repo.jobs.update(jobId, { status: "running" });

  const saved: Post[] = [];
  await Promise.all(
    job.platforms.map(async (platform) => {
      const run = runs.find((r) => r.platform === platform)!;
      run.status = "running";
      await persistRuns();
      try {
        const inputs = await fetchPlatform(platform, job.topic, run.limit ?? env.apifyMaxItems, (runId) => {
          run.runId = runId;
          void persistRuns();
        });
        const posts = await repo.posts.upsertMany(inputs);
        saved.push(...posts);
        Object.assign(run, { status: "succeeded", items: posts.length });
        await cache.set(freshKey(platform, job.topic), "1", env.scrapeCacheTtl);
      } catch (error) {
        Object.assign(run, { status: "failed", error: error instanceof Error ? error.message : String(error) });
        console.error(`[virallens] ${platform} scrape failed for "${job.topic}":`, error);
      }
      await repo.jobs.update(jobId, { runs, postsFound: saved.length });
    }),
  );

  const failed = runs.filter((r) => r.status === "failed");
  await repo.jobs.update(jobId, {
    status: failed.length === runs.length ? "failed" : "succeeded",
    error: failed.length ? failed.map((r) => `${r.platform}: ${r.error}`).join("; ") : null,
    postsFound: saved.length,
    finishedAt: new Date().toISOString(),
  });
  await cache.del(inflightKey(job.platforms, job.topic));
  return saved;
}
