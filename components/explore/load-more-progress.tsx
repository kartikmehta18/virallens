"use client";

import { Check, Loader2, X } from "lucide-react";
import { PlatformIcon } from "@/components/icons/platform-icon";
import { PLATFORM_LABELS } from "@/lib/client/filters";
import { useScrapeJob } from "@/lib/client/hooks";
import { parseCreatorKey } from "@/lib/creators";
import type { CreatorRun } from "./creator-fetch";

// Progress for "Load more posts", shown next to the button (the banners at the top of the page are out
// of view by the time you reach the end of the results).

const chip = "bg-surface-2 text-muted flex max-w-[16rem] items-center gap-1.5 rounded-full px-2.5 py-1 text-xs";

function StatusIcon({ state }: { state: "running" | "done" | "failed" }) {
  if (state === "running") return <Loader2 className="size-3 shrink-0 animate-spin" />;
  if (state === "failed") return <X className="size-3 shrink-0 text-amber-500" />;
  return <Check className="size-3 shrink-0 text-emerald-500" />;
}

/** Per-platform chips for a topic scrape job: which slice or related search each platform is running. */
export function JobProgress({ jobId }: { jobId: string }) {
  const { data: job } = useScrapeJob(jobId);
  if (!job) return null;
  return (
    <div className="flex flex-wrap justify-center gap-1.5">
      {job.runs.map((run) => (
        <span key={run.platform} className={chip} title={run.error}>
          <PlatformIcon platform={run.platform} className="size-3 shrink-0" />
          <span className="truncate">
            {PLATFORM_LABELS[run.platform]}
            {run.query && ` · “${run.query}”`}
            {run.status === "succeeded" && ` · +${run.newPostIds?.length ?? 0}`}
          </span>
          <StatusIcon state={run.status === "failed" ? "failed" : run.status === "succeeded" ? "done" : "running"} />
        </span>
      ))}
    </div>
  );
}

/** Per-creator chips for a creators load-more. */
export function CreatorProgress({ runs }: { runs: CreatorRun[] }) {
  return (
    <div className="flex flex-wrap justify-center gap-1.5">
      {runs.map((run) => {
        const ref = parseCreatorKey(run.key);
        const running = run.status === "pending" || run.status === "running";
        return (
          <span key={run.key} className={chip} title={run.error}>
            {ref && <PlatformIcon platform={ref.platform} className="size-3 shrink-0" />}
            <span className="truncate">
              {run.label}
              {!running && run.status !== "failed" && ` · +${run.newPostIds?.length ?? 0}`}
            </span>
            <StatusIcon state={running ? "running" : run.status === "failed" ? "failed" : "done"} />
          </span>
        );
      })}
    </div>
  );
}
