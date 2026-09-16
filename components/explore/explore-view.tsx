"use client";

import { keepPreviousData, useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, SearchX } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BentoGrid, GridSkeleton, featuredThreshold } from "@/components/grid/bento-grid";
import { Crosshairs } from "@/components/ui/primitives";
import { api } from "@/lib/client/api";
import { DEFAULT_FILTERS, filtersFromParams, filtersToParams, type ExploreFilters } from "@/lib/client/filters";
import { readPreferences, usePreferences } from "@/lib/client/preferences";
import type { PostPage, ScrapeJob } from "@/lib/types";
import { ScrapeBanner } from "./scrape-banner";
import { SearchComposer } from "./search-composer";
import { TrendChart } from "./trend-chart";

const PAGE_SIZE = 24;

type ScrapeResponse = { status: "cached" } | { status: "started" | "inflight"; jobId: string };

export function ExploreView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [prefs] = usePreferences();

  // URL params that are missing fall back to the user's saved defaults (Settings → Explore defaults).
  // ExploreView renders client-only (useSearchParams bails out of SSR), so reading localStorage here is safe.
  const [urlDefaults] = useState<ExploreFilters>(() => {
    const saved = readPreferences();
    return { ...DEFAULT_FILTERS, sort: [saved.defaultSort], dateRange: saved.defaultDateRange, platforms: saved.defaultPlatforms };
  });

  // Filters mirror the URL, but only while we're on "/": when the post modal is open the URL is
  // /post/[id] and the grid underneath must keep its current results.
  const [filters, setFilters] = useState<ExploreFilters>(() => filtersFromParams(searchParams, urlDefaults));
  const [syncedParams, setSyncedParams] = useState(searchParams.toString());
  if (pathname === "/explore" && searchParams.toString() !== syncedParams) {
    setSyncedParams(searchParams.toString());
    setFilters(filtersFromParams(searchParams, urlDefaults));
  }

  const [jobId, setJobId] = useState<string | null>(null);
  const apiParams = filtersToParams(filters).toString();

  const updateFilters = useCallback(
    (patch: Partial<ExploreFilters>) => {
      const next = { ...filters, ...patch };
      const qs = filtersToParams(next, urlDefaults).toString();
      setFilters(next);
      setSyncedParams(qs);
      router.replace(qs ? `/explore?${qs}` : "/explore", { scroll: false });
    },
    [filters, router, urlDefaults],
  );

  const scrape = useMutation({
    mutationFn: ({ topic, force }: { topic: string; force?: boolean }) =>
      api<ScrapeResponse>("/api/scrape", { method: "POST", json: { topic, platforms: filters.platforms, force } }),
    onSuccess: (result) => {
      if (result.status !== "cached") setJobId(result.jobId);
    },
  });

  const posts = useInfiniteQuery({
    queryKey: ["posts", apiParams],
    queryFn: ({ pageParam }) => api<PostPage>(`/api/posts?${apiParams}${apiParams ? "&" : ""}page=${pageParam}&limit=${PAGE_SIZE}`),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    placeholderData: keepPreviousData,
  });

  // Auto-refresh a topic that arrives via URL (shared link, hashtag click). The server skips fresh topics.
  const autoScraped = useRef<string | null>(null);
  useEffect(() => {
    if (pathname !== "/explore" || !prefs.autoFetch || !filters.topic || autoScraped.current === filters.topic) return;
    autoScraped.current = filters.topic;
    scrape.mutate({ topic: filters.topic });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.topic, pathname, prefs.autoFetch]);

  const onSearch = (topic: string) => {
    autoScraped.current = topic;
    updateFilters({ topic });
    if (prefs.autoFetch && topic.length >= 2) scrape.mutate({ topic });
  };

  const onScrapeFinished = useCallback(
    (job: ScrapeJob) => {
      if (job.postsFound > 0) {
        queryClient.invalidateQueries({ queryKey: ["posts"] });
        queryClient.invalidateQueries({ queryKey: ["timeline"] });
      }
    },
    [queryClient],
  );
  const dismissBanner = useCallback(() => setJobId(null), []);

  const items = useMemo(() => posts.data?.pages.flatMap((p) => p.items) ?? [], [posts.data]);
  const threshold = useMemo(() => featuredThreshold(posts.data?.pages[0]?.items ?? []), [posts.data?.pages]);
  const total = posts.data?.pages[0]?.total ?? 0;

  const sentinel = useRef<HTMLDivElement>(null);
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = posts;
  useEffect(() => {
    const node = sentinel.current;
    if (!node || !hasNextPage) return;
    const observer = new IntersectionObserver(([entry]) => entry.isIntersecting && !isFetchingNextPage && fetchNextPage(), {
      rootMargin: "800px 0px",
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const scraping = scrape.isPending || Boolean(jobId);
  const docked = prefs.searchPosition === "bottom";

  const composer = (
    <SearchComposer
      docked={docked}
      filters={filters}
      onChange={updateFilters}
      onSearch={onSearch}
      onRefresh={() => filters.topic && scrape.mutate({ topic: filters.topic, force: true })}
      scraping={scraping}
    />
  );

  return (
    <div className={`mx-auto max-w-[1600px] space-y-5 px-5 py-10 min-[1880px]:max-w-[2200px] sm:px-8 lg:px-10 ${docked ? "pb-60" : ""}`}>
      <div className="mb-4">
        <h1 className="display text-[34px] sm:text-[44px]">
          {filters.topic ? (
            <>
              What&apos;s going viral in <span className="text-viral">{filters.topic}</span>
            </>
          ) : filters.creators.length ? (
            <>
              Posts from <span className="text-viral">your creators</span>
            </>
          ) : (
            <>
              Discover what&apos;s <span className="text-viral">going viral</span>
            </>
          )}
        </h1>
        <p className="text-muted mt-3 text-[15px]">
          Top performing posts across X, LinkedIn and Instagram — ranked by cross-platform virality.
        </p>
      </div>

      {!docked && composer}

      {scrape.isError && (
        <p className="rounded-md border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-400">{scrape.error.message}</p>
      )}
      <ScrapeBanner jobId={jobId} onFinished={onScrapeFinished} onDismiss={dismissBanner} />

      {prefs.showTrendChart && <TrendChart topic={filters.topic} platforms={filters.platforms} creators={filters.creators} />}

      <div className="text-muted flex items-center justify-between pt-1 text-sm">
        <span>{posts.isSuccess && `${total.toLocaleString()} post${total === 1 ? "" : "s"}`}</span>
        {posts.isFetching && !posts.isFetchingNextPage && <Loader2 className="size-4 animate-spin" />}
      </div>

      {posts.isLoading ? (
        <GridSkeleton count={15} />
      ) : posts.isError ? (
        <div className="border-border text-muted border p-10 text-center text-sm">Couldn&apos;t load posts: {posts.error.message}</div>
      ) : items.length === 0 ? (
        <div className="border-border relative flex flex-col items-center border px-6 py-20 text-center">
          <Crosshairs />
          <SearchX className="text-muted size-8" />
          <p className="mt-3 font-medium">{scraping ? "Fetching posts from the sources…" : "No posts match these filters yet"}</p>
          <p className="text-muted mt-1 max-w-md text-sm">
            {scraping
              ? "This usually takes under a minute. Results appear here automatically."
              : "Try a broader topic, another platform, or a longer date range."}
          </p>
        </div>
      ) : (
        <div className={`transition-opacity ${posts.isPlaceholderData ? "opacity-50" : ""}`}>
          <BentoGrid posts={items} threshold={threshold} density={prefs.density} />
          <div ref={sentinel} className="h-px" />
          {posts.isFetchingNextPage && (
            <div className="mt-3">
              <GridSkeleton count={5} />
            </div>
          )}
          {!posts.hasNextPage && items.length > PAGE_SIZE && (
            <p className="text-muted py-8 text-center text-sm">You&apos;ve reached the end.</p>
          )}
        </div>
      )}

      {docked && composer}
    </div>
  );
}
