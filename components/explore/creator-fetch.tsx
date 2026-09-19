"use client";

import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Loader2, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { PlatformIcon } from "@/components/icons/platform-icon";
import { api } from "@/lib/client/api";
import type { CreatorFetchResult } from "@/lib/client/hooks";
import { parseCreatorKey } from "@/lib/creators";

// Fetching new posts for the favorite creators selected in the explore composer. Each creator is its own
// Apify profile run (POST /api/creators/fetch), so they run a few at a time and posts show up as each
// creator finishes. Creators fetched within SCRAPE_CACHE_TTL come back "cached" at no cost.

const CONCURRENCY = 3;

export interface CreatorTarget {
  key: string;
  label: string;
}

export interface CreatorRun extends CreatorTarget {
  status: "pending" | "running" | CreatorFetchResult["status"] | "failed";
  postsFound: number;
  /** Posts this fetch added that were not stored before. */
  newPostIds?: string[];
  error?: string;
}

interface FetchState {
  id: number;
  more: boolean;
  runs: CreatorRun[];
}

const isRunning = (run: CreatorRun) => run.status === "pending" || run.status === "running";

export function useCreatorFetch() {
  const queryClient = useQueryClient();
  const [state, setState] = useState<FetchState | null>(null);
  const counter = useRef(0);
  const current = useRef<FetchState | null>(null);
  useEffect(() => {
    current.current = state;
  }, [state]);

  /**
   * Fetches every target; resolves with this call's own results. `more` goes further back in each
   * timeline, `force` ignores the freshness cache. A plain fetch started while another plain fetch is
   * running joins its banner instead of replacing it (e.g. picking a second creator mid-fetch).
   */
  const start = useCallback(
    async (targets: CreatorTarget[], options: { force?: boolean; more?: boolean } = {}): Promise<CreatorRun[]> => {
      const more = Boolean(options.more);
      const running = current.current;
      const join = running && running.more === more && running.runs.some(isRunning);
      const id = join ? running.id : ++counter.current;
      const known = new Set(join ? running.runs.map((r) => r.key) : []);
      const fresh: CreatorRun[] = targets.filter((t) => !known.has(t.key)).map((t) => ({ ...t, status: "pending", postsFound: 0 }));
      if (!fresh.length) return [];
      setState((s) => (join && s?.id === id ? { ...s, runs: [...s.runs, ...fresh] } : { id, more, runs: fresh }));

      const results = new Map(fresh.map((run) => [run.key, run]));
      const patch = (key: string, update: Partial<CreatorRun>) => {
        results.set(key, { ...results.get(key)!, ...update });
        setState((s) => (s?.id === id ? { ...s, runs: s.runs.map((r) => (r.key === key ? { ...r, ...update } : r)) } : s));
      };

      const queue = [...fresh];
      const worker = async () => {
        for (let run = queue.shift(); run; run = queue.shift()) {
          const ref = parseCreatorKey(run.key);
          if (!ref) {
            patch(run.key, { status: "failed", error: "Unknown creator" });
            continue;
          }
          patch(run.key, { status: "running" });
          try {
            const result = await api<CreatorFetchResult>("/api/creators/fetch", {
              method: "POST",
              json: { ...ref, force: options.force, more },
            });
            patch(run.key, { status: result.status, postsFound: result.postsFound, newPostIds: result.newPostIds });
            if (result.postsFound > 0) {
              // Show each creator's posts as soon as they land instead of waiting for the slowest run.
              queryClient.invalidateQueries({ queryKey: ["posts"] });
              queryClient.invalidateQueries({ queryKey: ["timeline"] });
              queryClient.invalidateQueries({ queryKey: ["creator-posts"] });
            }
          } catch (error) {
            patch(run.key, { status: "failed", error: error instanceof Error ? error.message : String(error) });
          }
        }
      };
      await Promise.all(Array.from({ length: Math.min(CONCURRENCY, fresh.length) }, worker));
      queryClient.invalidateQueries({ queryKey: ["creators"] });
      queryClient.invalidateQueries({ queryKey: ["creator-profile"] });
      return [...results.values()];
    },
    [queryClient],
  );

  const dismiss = useCallback(() => setState(null), []);
  const running = state?.runs.some(isRunning) ?? false;
  return { state, running, start, dismiss };
}

function summary(runs: CreatorRun[], more: boolean, running: boolean) {
  const n = runs.length;
  const who = n === 1 ? runs[0].label : `${n} creators`;
  if (running) return more ? `Fetching older posts from ${who}` : `Fetching new posts from ${who}`;
  const found = runs.reduce((sum, r) => sum + r.postsFound, 0);
  const failed = runs.filter((r) => r.status === "failed").length;
  if (failed === n) return `Couldn't fetch posts from ${who}`;
  if (runs.every((r) => r.status === "cached")) return `${n === 1 ? runs[0].label : "Your creators"} — already up to date`;
  if (runs.every((r) => r.status === "exhausted")) return `No older posts to fetch from ${who}`;
  return `Found ${found} post${found === 1 ? "" : "s"} from ${who}`;
}

const chipDetail = (run: CreatorRun) =>
  run.status === "failed"
    ? " · failed"
    : run.status === "cached"
      ? " · up to date"
      : run.status === "exhausted"
        ? " · all fetched"
        : ` · ${run.postsFound}`;

/** Per-creator progress for a creator fetch, styled like the topic ScrapeBanner. */
export function CreatorFetchBanner({ state, running, onDismiss }: { state: FetchState | null; running: boolean; onDismiss: () => void }) {
  const failed = state?.runs.some((r) => r.status === "failed") ?? false;
  useEffect(() => {
    if (!state || running) return;
    const timer = setTimeout(onDismiss, failed ? 9000 : 5000);
    return () => clearTimeout(timer);
  }, [state, running, failed, onDismiss]);

  return (
    <AnimatePresence>
      {state && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="overflow-hidden"
        >
          <div className="border-border bg-surface flex flex-wrap items-center gap-3 rounded-lg border px-4 py-3 text-sm">
            {running ? (
              <Loader2 className="text-accent size-4 animate-spin" />
            ) : failed ? (
              <AlertTriangle className="size-4 text-amber-500" />
            ) : (
              <CheckCircle2 className="size-4 text-emerald-500" />
            )}
            <span className="min-w-0 font-medium">{summary(state.runs, state.more, running)}</span>
            <div className="flex min-w-0 flex-wrap gap-1.5">
              {state.runs.map((run) => {
                const ref = parseCreatorKey(run.key);
                return (
                  <span
                    key={run.key}
                    title={run.error}
                    className={`flex max-w-[16rem] items-center gap-1.5 rounded-full px-2.5 py-1 text-xs ${
                      run.status === "failed" ? "bg-amber-500/10 text-amber-600 dark:text-amber-400" : "bg-surface-2 text-muted"
                    }`}
                  >
                    {ref && <PlatformIcon platform={ref.platform} className="size-3 shrink-0" />}
                    <span className="truncate">{run.label}</span>
                    {isRunning(run) ? (
                      <Loader2 className="size-3 shrink-0 animate-spin" />
                    ) : (
                      <span className="shrink-0">{chipDetail(run)}</span>
                    )}
                  </span>
                );
              })}
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
