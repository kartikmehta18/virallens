import "server-only";
import { understandQuery } from "../ai/query";
import { getCache } from "../cache";
import type { RawItem, ScrapePage } from "../apify/client";
import { generateDemoPosts } from "../apify/demo";
import { scrapeInstagram } from "../apify/instagram";
import { scrapeLinkedIn } from "../apify/linkedin";
import { NORMALIZERS } from "../apify/normalize";
import { scrapeX } from "../apify/x";
import { env } from "../env";
import { ApiError } from "../http";
import { getRepo } from "../repo";
import type { Repository } from "../repo/types";
import { normalizeTopic } from "../text";
import type { Platform, Post, PostInput, ScrapeJob, ScrapeRunInfo } from "../types";

type Scraper = (topic: string, limit: number, onStart?: (runId: string) => void, page?: ScrapePage) => Promise<RawItem[]>;

const SCRAPERS: Record<Platform, Scraper> = {
  x: scrapeX,
  linkedin: scrapeLinkedIn,
  instagram: scrapeInstagram,
};

const freshKey = (platform: Platform, topic: string) => `scrape:fresh:${platform}:${topic.toLowerCase()}`;
const inflightKey = (platforms: Platform[], topic: string) => `scrape:inflight:${[...platforms].sort().join(",")}:${topic.toLowerCase()}`;
/** "Load more" clicks so far for a topic on a platform, and whether its results ran out. */
const stepKey = (platform: Platform, topic: string) => `scrape:more:${platform}:${topic.toLowerCase()}`;
const doneKey = (platform: Platform, topic: string) => `scrape:more-done:${platform}:${topic.toLowerCase()}`;
const MORE_TTL = 7 * 24 * 60 * 60;
/** Load-more clicks per topic and platform (each costs about one normal search) before "exhausted". */
const MAX_STEPS = 6;
/** Ids of newly added posts kept on each run, for the "Just fetched" section. */
const NEW_IDS_CAP = 200;

export type ScrapeRequestResult =
  | { status: "cached"; platforms: Platform[] }
  | { status: "exhausted"; platforms: Platform[] }
  | { status: "started" | "inflight"; job: ScrapeJob };

/**
 * Decides whether a topic needs a fresh scrape. Returns "cached" if every platform was scraped
 * within SCRAPE_CACHE_TTL, otherwise creates a job (the caller runs it in the background).
 *
 * `more` is "load more": re-running the same search would return (and bill) the same top results, so each
 * click asks every platform for its next slice instead — see planStep(). Returns "exhausted" once every
 * platform has run out or used MAX_STEPS clicks.
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

  const steps = new Map<Platform, number>();
  if (options.more) {
    for (const platform of options.platforms) {
      if (await cache.get(doneKey(platform, topic))) continue;
      const step = (Number(await cache.get(stepKey(platform, topic))) || 0) + 1;
      if (step <= MAX_STEPS) steps.set(platform, step);
    }
    if (!steps.size) return { status: "exhausted", platforms: options.platforms };
  }

  const stale: Platform[] = [];
  for (const platform of options.platforms) {
    if (options.more ? steps.has(platform) : options.force || !(await cache.get(freshKey(platform, topic)))) stale.push(platform);
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
    runs: stale.map((platform) => ({ platform, source, status: "pending", ...(steps.has(platform) && { step: steps.get(platform) }) })),
  });
  await cache.set(inflightKey(stale, topic), job.id, 15 * 60);
  // Claim the step now, so a second click while this job runs fetches the slice after it.
  for (const [platform, step] of steps) await cache.set(stepKey(platform, topic), String(step), MORE_TTL);
  return { status: "started", job };
}

/**
 * What a "load more" step fetches. Odd steps page further into the topic's own results (X: older than the
 * oldest stored post; LinkedIn: newest-first, then later result pages; Instagram: reels/posts, deeper).
 * Even steps search a related query from understandQuery() (Gemini) when there is one ("devops" →
 * "kubernetes"); its posts are stored under the original topic so they show in the current results.
 */
async function planStep(
  repo: Repository,
  platform: Platform,
  topic: string,
  step: number | undefined,
): Promise<{ query: string; page?: ScrapePage }> {
  if (!step) return { query: topic };
  const related = (await understandQuery(topic)).related;
  if (step % 2 === 0 && related[step / 2 - 1]) return { query: related[step / 2 - 1] };
  const index = step - Math.min(Math.floor(step / 2), related.length);
  const before = platform === "x" ? await repo.posts.oldestPublished("x", { topic }) : null;
  return { query: topic, page: { index, before } };
}

async function fetchPlatform(
  platform: Platform,
  query: string,
  topic: string,
  onStart: (runId: string) => void,
  page?: ScrapePage,
): Promise<PostInput[]> {
  if (!env.apifyToken) {
    await new Promise((resolve) => setTimeout(resolve, 1200 + Math.random() * 1500));
    // Demo posts are seeded per query, so a later page returns the same first posts plus new ones.
    return generateDemoPosts(query, platform, Math.min(18 * (page ? page.index + 1 : 1), 126)).map((post) => ({ ...post, topic }));
  }
  const raw = await SCRAPERS[platform](query, env.apifyMaxItems, onStart, page);
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
        const plan = await planStep(repo, platform, job.topic, run.step);
        if (plan.query !== job.topic) run.query = plan.query;
        const inputs = await fetchPlatform(
          platform,
          plan.query,
          job.topic,
          (runId) => {
            run.runId = runId;
            void persistRuns();
          },
          plan.page,
        );
        const { posts, createdIds } = await repo.posts.upsertMany(inputs);
        saved.push(...posts);
        Object.assign(run, { status: "succeeded", items: posts.length, newPostIds: createdIds.slice(0, NEW_IDS_CAP) });
        await cache.set(freshKey(platform, job.topic), "1", env.scrapeCacheTtl);
        // A page of the topic's own results with nothing new: this platform has run out.
        if (run.step && plan.page && !createdIds.length) await cache.set(doneKey(platform, job.topic), "1", MORE_TTL);
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
