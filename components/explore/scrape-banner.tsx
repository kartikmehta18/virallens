"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Loader2, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef } from "react";
import { PlatformIcon } from "@/components/icons/platform-icon";
import { api } from "@/lib/client/api";
import { PLATFORM_LABELS } from "@/lib/client/filters";
import type { ScrapeJob } from "@/lib/types";

interface Props {
  jobId: string | null;
  onFinished: (job: ScrapeJob) => void;
  onDismiss: () => void;
}

const isDone = (job?: ScrapeJob) => job?.status === "succeeded" || job?.status === "failed";

/** Polls a scrape job and shows per-platform progress while Apify actors run. */
export function ScrapeBanner({ jobId, onFinished, onDismiss }: Props) {
  const { data: job } = useQuery({
    queryKey: ["scrape", jobId],
    queryFn: () => api<ScrapeJob>(`/api/scrape/status/${jobId}`),
    enabled: Boolean(jobId),
    refetchInterval: (query) => (isDone(query.state.data) ? false : 2500),
  });

  const reported = useRef<string | null>(null);
  useEffect(() => {
    if (job && isDone(job) && reported.current !== job.id) {
      reported.current = job.id;
      onFinished(job);
      const timer = setTimeout(onDismiss, job.status === "failed" ? 9000 : 4000);
      return () => clearTimeout(timer);
    }
  }, [job, onFinished, onDismiss]);

  return (
    <AnimatePresence>
      {jobId && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="overflow-hidden"
        >
          <div className="border-border bg-surface flex flex-wrap items-center gap-3 rounded-lg border px-4 py-3 text-sm">
            {!job || !isDone(job) ? (
              <Loader2 className="text-accent size-4 animate-spin" />
            ) : job.status === "failed" ? (
              <AlertTriangle className="size-4 text-amber-500" />
            ) : (
              <CheckCircle2 className="size-4 text-emerald-500" />
            )}
            <span className="font-medium">
              {!job || !isDone(job)
                ? `Fetching fresh posts for “${job?.topic ?? "…"}”`
                : job.status === "failed"
                  ? "Couldn't fetch new posts"
                  : `Found ${job.postsFound} posts for “${job.topic}”`}
            </span>
            <div className="flex flex-wrap gap-1.5">
              {job?.runs.map((run) => (
                <span
                  key={run.platform}
                  title={run.error}
                  className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs ${
                    run.status === "failed" ? "bg-amber-500/10 text-amber-600 dark:text-amber-400" : "bg-surface-2 text-muted"
                  }`}
                >
                  <PlatformIcon platform={run.platform} className="size-3" />
                  {PLATFORM_LABELS[run.platform]}
                  {run.status === "running" || run.status === "pending" ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : run.status === "failed" ? (
                    " · failed"
                  ) : (
                    ` · ${run.items ?? 0}`
                  )}
                </span>
              ))}
              {job?.runs[0]?.source === "demo" && (
                <span className="bg-surface-2 text-muted rounded-full px-2.5 py-1 text-xs">demo data</span>
              )}
            </div>
            <button
              onClick={onDismiss}
              className="text-muted hover:bg-surface-2 ml-auto grid size-7 place-items-center rounded-full"
              aria-label="Dismiss"
            >
              <X className="size-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
