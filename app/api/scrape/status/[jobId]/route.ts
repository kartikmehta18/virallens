import type { NextRequest } from "next/server";
import { ApiError, handler, json } from "@/lib/http";
import { getRepo } from "@/lib/repo";

export const GET = handler(async (_request: NextRequest, ctx: RouteContext<"/api/scrape/status/[jobId]">) => {
  const { jobId } = await ctx.params;
  const job = await (await getRepo()).jobs.get(jobId);
  if (!job) throw new ApiError(404, "Job not found");
  return json(job);
});
