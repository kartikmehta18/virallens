import { after, type NextRequest } from "next/server";
import { postSearchQuery } from "@/lib/ai/query";
import { getCurrentUser } from "@/lib/auth/session";
import { ApiError, clientIp, handler, json } from "@/lib/http";
import { getRepo } from "@/lib/repo";
import { executeScrapeJob, requestScrape } from "@/lib/scrape/pipeline";
import { keyTerms } from "@/lib/similar";
import { PLATFORMS } from "@/lib/types";

export const maxDuration = 300;

/**
 * POST /api/posts/[id]/similar/more — the similar-posts rail ran out, so fetch new posts about the same
 * subject from the platforms. The subject comes from Gemini (cached per post) or the post's key words.
 * The first call runs a normal search for that subject; later calls page further ("load more").
 * → { status: "started" | "inflight", jobId, query } | { status: "cached" | "exhausted", query }
 */
export const POST = handler(async (request: NextRequest, ctx: RouteContext<"/api/posts/[id]/similar/more">) => {
  const { id } = await ctx.params;
  const post = await (await getRepo()).posts.byId(id);
  if (!post) throw new ApiError(404, "Post not found");

  const query = await postSearchQuery(post, keyTerms(post).slice(0, 3).join(" ") || post.topic);
  const user = await getCurrentUser(request);
  const base = { topic: query, platforms: [...PLATFORMS], userId: user?.id ?? null, rateKey: user?.id ?? clientIp(request) };
  let result = await requestScrape(base);
  // Already searched recently: go to the next slice instead of returning the same posts.
  if (result.status === "cached") result = await requestScrape({ ...base, more: true });

  if (result.status === "started") {
    const jobId = result.job.id;
    after(() => executeScrapeJob(jobId).catch((error) => console.error("[virallens] similar fetch failed:", error)));
  }
  return json("job" in result ? { status: result.status, jobId: result.job.id, query } : { status: result.status, query });
});
