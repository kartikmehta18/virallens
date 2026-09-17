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

export type ScrapeRequestResult = { status: "cached"; platforms: Platform[] } | { status: "started" | "inflight"; job: ScrapeJob };

/**
 * Decides whether a topic needs a fresh scrape. Returns "cached" if every platform was scraped
 * within SCRAPE_CACHE_TTL, otherwise creates a job (the caller runs it in the background).
 */
export async function requestScrape(options: {
  topic: string;
  platforms: Platform[];
  userId: string | null;
  rateKey: string;
  force?: boolean;
}): Promise<ScrapeRequestResult> {
  const topic = normalizeTopic(options.topic);
  if (topic.length < 2) throw new ApiError(400, "Topic must be at least 2 characters");
  const cache = await getCache();
  const repo = await getRepo();

  const stale: Platform[] = [];
  for (const platform of options.platforms) {
    if (options.force || !(await cache.get(freshKey(platform, topic)))) stale.push(platform);
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
    runs: stale.map((platform) => ({ platform, source, status: "pending" })),
  });
  await cache.set(inflightKey(stale, topic), job.id, 15 * 60);
  return { status: "started", job };
}

async function fetchPlatform(platform: Platform, topic: string, onStart: (runId: string) => void): Promise<PostInput[]> {
  const limit = env.apifyMaxItems;
  if (!env.apifyToken) {
    await new Promise((resolve) => setTimeout(resolve, 1200 + Math.random() * 1500));
    return generateDemoPosts(topic, platform, Math.min(limit, 18));
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
        const inputs = await fetchPlatform(platform, job.topic, (runId) => {
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
