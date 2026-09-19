import { after, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { clientIp, handler, json, readJson } from "@/lib/http";
import { parsePlatforms } from "@/lib/query";
import { executeScrapeJob, requestScrape } from "@/lib/scrape/pipeline";

export const maxDuration = 300;

/**
 * POST /api/scrape { topic, platforms?, force?, more?, wait? }
 * Returns { status: "cached" } when results are fresh, otherwise starts a background job
 * (poll GET /api/scrape/status/[jobId]). Pass wait: true to block until the job finishes.
 * more: true ("load more") scrapes deeper than last time; { status: "exhausted" } when it can't go deeper.
 */
export const POST = handler(async (request: NextRequest) => {
  const body = await readJson<{ topic?: string; platforms?: string[]; force?: boolean; more?: boolean; wait?: boolean }>(request);
  const user = await getCurrentUser(request);
  const result = await requestScrape({
    topic: body.topic ?? "",
    platforms: parsePlatforms(body.platforms),
    userId: user?.id ?? null,
    rateKey: user?.id ?? clientIp(request),
    force: Boolean(body.force),
    more: Boolean(body.more),
  });

  if (result.status === "started") {
    if (body.wait) {
      const posts = await executeScrapeJob(result.job.id);
      return json({ status: "finished", jobId: result.job.id, postsFound: posts.length });
    }
    after(() => executeScrapeJob(result.job.id).catch((error) => console.error("[virallens] scrape job failed:", error)));
  }

  return json("job" in result ? { status: result.status, jobId: result.job.id, job: result.job } : result, {
    status: result.status === "started" ? 202 : 200,
  });
});
