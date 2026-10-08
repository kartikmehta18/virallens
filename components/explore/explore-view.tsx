"use client";

import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Loader2, SearchX } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { BentoGrid, GridSkeleton, featuredThreshold } from "@/components/grid/bento-grid";
import { Crosshairs } from "@/components/ui/primitives";
import { api } from "@/lib/client/api";
import { DEFAULT_FILTERS, RANGE_LABELS, filtersFromParams, filtersToParams, type ExploreFilters } from "@/lib/client/filters";
import { newPostIdsOf, useFavoriteCreators } from "@/lib/client/hooks";
import { readPreferences, usePreferences } from "@/lib/client/preferences";
import { creatorKey, parseCreatorKey } from "@/lib/creators";
import { groupByRelated, parseSearch, suggestions } from "@/lib/search";
import type { Post, PostPage, ScrapeJob } from "@/lib/types";
import { CreatorFetchBanner, useCreatorFetch, type CreatorTarget } from "./creator-fetch";
import { CreatorProgress, JobProgress } from "./load-more-progress";
import { ScrapeBanner } from "./scrape-banner";
import { SearchComposer } from "./search-composer";
import { SearchInsight, SuggestionChips, useQueryInsight } from "./search-insight";
import { TrendChart } from "./trend-chart";

const PAGE_SIZE = 24;
const NO_IDS: string[] = [];
/** While a fetch runs, the feed refreshes at most this often as posts arrive (it always refreshes at the end). */
const PROGRESS_REFRESH_MS = 6000;
/** Most "Just fetched" ids kept (matches MAX_IDS in lib/query.ts); newest fetches win. */
const MAX_FETCHED = 300;

type ScrapeResponse = { status: "cached" | "exhausted" } | { status: "started" | "inflight"; jobId: string };

/** A "Load more posts" in progress: what it was for (see moreScope), for which filters, and what it added. */
interface MoreState {
  scope: string;
  params: string;
  jobId: string | null;
  done: boolean;
  added: number;
}

const authorKey = (post: Post) => creatorKey({ platform: post.platform, handle: post.authorHandle });

function SectionHeading({ children }: { children: ReactNode }) {
  return <h2 className="text-muted mt-2 mb-3 text-xs font-semibold tracking-[0.14em] uppercase">{children}</h2>;
}

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
  const [more, setMore] = useState<MoreState | null>(null);
  const [exhaustedScope, setExhaustedScope] = useState<string | null>(null);
  // Posts that "Load more posts" added, shown in their own section at the bottom — for these filters only.
  const [fetched, setFetched] = useState<{ params: string; ids: string[] }>({ params: "", ids: [] });
  const apiParams = filtersToParams(filters).toString();
  const justFetchedIds = fetched.params === apiParams ? fetched.ids : NO_IDS;
  // "Load more posts" goes further back in time on purpose, so the posts it adds are shown even when
  // they're older than the selected date range (every other filter still applies).
  const fetchedParams = filtersToParams({ ...filters, dateRange: "all", from: "", to: "" }).toString();

  // Favorite creators: without a topic they filter the results to those creators (new content comes from
  // their profiles). With a topic they're boosted — their matching posts first, then everyone else's — and
  // both their profiles and the topic are fetched.
  const creatorFetch = useCreatorFetch();
  const { start: startCreatorFetch } = creatorFetch;
  const { data: favorites } = useFavoriteCreators();
  const targetsFor = useCallback(
    (keys: string[]): CreatorTarget[] => {
      const names = new Map((favorites ?? []).map((c) => [creatorKey(c), c.name]));
      return keys.map((key) => ({ key, label: names.get(key) || `@${parseCreatorKey(key)?.handle ?? key}` }));
    },
    [favorites],
  );
  const creatorTargets = useMemo(() => targetsFor(filters.creators), [targetsFor, filters.creators]);
  const byCreators = creatorTargets.length > 0;
  const boosted = byCreators && Boolean(filters.topic);
  const moreScope = filters.topic ? `topic:${filters.topic.toLowerCase()}` : `creators:${[...filters.creators].sort().join(",")}`;

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
    mutationFn: ({ topic, platforms = filters.platforms, force }: { topic: string; platforms?: ExploreFilters["platforms"]; force?: boolean }) =>
      api<ScrapeResponse>("/api/scrape", { method: "POST", json: { topic, platforms, force } }),
    onSuccess: (result) => {
      if ("jobId" in result) setJobId(result.jobId);
    },
  });

  const posts = useInfiniteQuery({
    queryKey: ["posts", apiParams],
    queryFn: ({ pageParam }) => api<PostPage>(`/api/posts?${apiParams}${apiParams ? "&" : ""}page=${pageParam}&limit=${PAGE_SIZE}`),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    placeholderData: keepPreviousData,
  });

  const justFetched = useQuery({
    queryKey: ["posts", fetchedParams, "ids", justFetchedIds.join(",")],
    queryFn: () =>
      api<PostPage>(`/api/posts?${fetchedParams}${fetchedParams ? "&" : ""}ids=${justFetchedIds.join(",")}&limit=${justFetchedIds.length}`),
    enabled: justFetchedIds.length > 0,
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

  // Creators that arrive via the URL (shared link, reload) fetch their new posts once per visit; the server
  // skips creators fetched within SCRAPE_CACHE_TTL. Creators picked in the composer are fetched on submit.
  const autoFetchedCreators = useRef(new Set<string>());
  useEffect(() => {
    if (pathname !== "/explore" || !prefs.autoFetch) return;
    const pending = creatorTargets.filter((t) => !autoFetchedCreators.current.has(t.key));
    if (!pending.length) return;
    const timer = setTimeout(() => {
      for (const t of pending) autoFetchedCreators.current.add(t.key);
      void startCreatorFetch(pending);
    }, 900);
    return () => clearTimeout(timer);
  }, [creatorTargets, pathname, prefs.autoFetch, startCreatorFetch]);

  /**
   * The composer's send button: applies every staged filter at once, then fetches from the sources only
   * what the change needs. Sort / date / format changes just re-query stored posts; a new topic, platform
   * or creator fetches those; re-sending unchanged filters refreshes the topic and all selected creators.
   */
  const onSubmit = (next: ExploreFilters) => {
    const topic = next.topic.trim().replace(/\s+/g, " ");
    const unchanged = filtersToParams({ ...next, topic }).toString() === apiParams;
    const platformsChanged = [...next.platforms].sort().join(",") !== [...filters.platforms].sort().join(",");
    const topicChanged = topic.toLowerCase() !== filters.topic.toLowerCase();
    autoScraped.current = topic;
    updateFilters({ ...next, topic });
    if (!prefs.autoFetch) return;
    const targets = targetsFor(next.creators).filter((t) => unchanged || !autoFetchedCreators.current.has(t.key));
    if (targets.length) {
      for (const t of targets) autoFetchedCreators.current.add(t.key);
      void startCreatorFetch(targets);
    }
    if (topic.length >= 2 && (unchanged || topicChanged || platformsChanged)) scrape.mutate({ topic, platforms: next.platforms });
  };
  const onSearch = (topic: string) => onSubmit({ ...filters, topic });

  /** Records what a finished load-more added, for the "Just fetched" section. */
  const finishMore = useCallback((state: MoreState, ids: string[]) => {
    setFetched((current) =>
      current.params === state.params
        ? { params: current.params, ids: [...new Set([...current.ids, ...ids])].slice(-MAX_FETCHED) }
        : { params: state.params, ids: ids.slice(-MAX_FETCHED) },
    );
    setMore({ ...state, done: true, added: ids.length });
  }, []);

  const onScrapeFinished = useCallback(
    (job: ScrapeJob) => {
      if (job.postsFound > 0) {
        queryClient.invalidateQueries({ queryKey: ["posts"] });
        queryClient.invalidateQueries({ queryKey: ["timeline"] });
      }
      if (more?.jobId === job.id) finishMore(more, newPostIdsOf(job));
    },
    [queryClient, more, finishMore],
  );
  // The topic's own posts are stored before its related searches run: show them (and each related search's
  // posts) as they arrive instead of only when the whole fetch is done.
  const lastProgressRefresh = useRef(0);
  const onScrapeProgress = useCallback(() => {
    if (Date.now() - lastProgressRefresh.current < PROGRESS_REFRESH_MS) return;
    lastProgressRefresh.current = Date.now();
    queryClient.invalidateQueries({ queryKey: ["posts"] });
    queryClient.invalidateQueries({ queryKey: ["timeline"] });
  }, [queryClient]);
  const dismissBanner = useCallback(() => setJobId(null), []);

  const hidden = useMemo(() => new Set(justFetchedIds), [justFetchedIds]);
  const items = useMemo(() => {
    // Trending scores refresh between page requests, which can shift a post onto the next page too.
    const seen = new Set(hidden);
    return (posts.data?.pages.flatMap((p) => p.items) ?? []).filter((p) => !seen.has(p.id) && Boolean(seen.add(p.id)));
  }, [posts.data, hidden]);
  const threshold = useMemo(() => featuredThreshold(posts.data?.pages[0]?.items ?? []), [posts.data?.pages]);
  const total = posts.data?.pages[0]?.total ?? 0;
  const creatorMatches = posts.data?.pages[0]?.creatorMatches ?? 0;
  const selectedCreators = useMemo(() => new Set(filters.creators), [filters.creators]);
  const fromCreators = boosted ? items.filter((p) => selectedCreators.has(authorKey(p))) : [];
  const fromEveryone = boosted ? items.filter((p) => !selectedCreators.has(authorKey(p))) : items;
  const fetchedItems = justFetched.data?.items ?? [];
  // A topic search ranks its own posts first, then each related search's ("Also showing" chips): one section each.
  const { data: insight } = useQueryInsight(filters.topic);
  const groups = useMemo(
    () => (filters.topic && !filters.exact && !boosted && insight?.related.length ? groupByRelated(items, filters.topic, insight) : null),
    [items, filters.topic, filters.exact, boosted, insight],
  );

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

  // Fetches the *next* slice from the sources (older/other posts rather than the same top results again):
  // for the topic when there is one, otherwise further back in the selected creators' timelines.
  const loadMore = useMutation({
    mutationFn: async (state: MoreState) => {
      if (!filters.topic) {
        const runs = await startCreatorFetch(creatorTargets, { more: true });
        return {
          state,
          exhausted: runs.length > 0 && runs.every((r) => r.status === "exhausted"),
          jobId: null,
          ids: runs.flatMap((r) => r.newPostIds ?? []),
        };
      }
      const result = await api<ScrapeResponse>("/api/scrape", {
        method: "POST",
        json: { topic: filters.topic, platforms: filters.platforms, more: true },
      });
      return { state, exhausted: result.status === "exhausted", jobId: "jobId" in result ? result.jobId : null, ids: [] };
    },
    onMutate: (state) => setMore(state),
    onSuccess: ({ state, exhausted, jobId: startedJob, ids }) => {
      if (exhausted) {
        setExhaustedScope(state.scope);
        setMore(null);
      } else if (startedJob) {
        // The topic job runs in the background; onScrapeFinished records what it added.
        setJobId(startedJob);
        setMore({ ...state, jobId: startedJob });
      } else {
        finishMore(state, ids);
      }
    },
    onError: () => setMore(null),
  });
  const moreHere = more?.scope === moreScope ? more : null;
  const loadingMore = loadMore.isPending || Boolean(moreHere && !moreHere.done);
  const canLoadMore = byCreators || Boolean(filters.topic);
  const startLoadMore = () => loadMore.mutate({ scope: moreScope, params: apiParams, jobId: null, done: false, added: 0 });

  const scraping = scrape.isPending || Boolean(jobId) || creatorFetch.running;
  const docked = prefs.searchPosition === "bottom";
  const parsed = useMemo(() => parseSearch(filters.topic), [filters.topic]);

  const composer = (
    <SearchComposer
      docked={docked}
      filters={filters}
      onSubmit={onSubmit}
      onRefresh={() => {
        if (byCreators) void startCreatorFetch(creatorTargets, { force: true });
        if (filters.topic) scrape.mutate({ topic: filters.topic, force: true });
      }}
      scraping={scraping}
    />
  );

  const grid = (list: Post[]) => <BentoGrid posts={list} threshold={threshold} density={prefs.density} />;

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

      {filters.topic && (
        <SearchInsight
          topic={filters.topic}
          exact={filters.exact}
          jobId={jobId}
          onSearch={(topic) => onSubmit({ ...filters, topic, exact: false })}
          onExactChange={(exact) => updateFilters({ exact })}
        />
      )}

      {scrape.isError && (
        <p className="rounded-md border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-400">{scrape.error.message}</p>
      )}
      <ScrapeBanner jobId={jobId} onFinished={onScrapeFinished} onProgress={onScrapeProgress} onDismiss={dismissBanner} />
      <CreatorFetchBanner state={creatorFetch.state} running={creatorFetch.running} onDismiss={creatorFetch.dismiss} />

      {prefs.showTrendChart && <TrendChart filters={filters} />}

      <div className="text-muted flex items-center justify-between pt-1 text-sm">
        <span>
          {posts.isSuccess && `${total.toLocaleString()} post${total === 1 ? "" : "s"}`}
          {posts.isSuccess && boosted && ` · ${creatorMatches.toLocaleString()} from your creators`}
        </span>
        {posts.isFetching && !posts.isFetchingNextPage && <Loader2 className="size-4 animate-spin" />}
      </div>

      {posts.isLoading ? (
        <GridSkeleton count={15} />
      ) : posts.isError ? (
        <div className="border-border text-muted border p-10 text-center text-sm">Couldn&apos;t load posts: {posts.error.message}</div>
      ) : items.length === 0 && fetchedItems.length === 0 ? (
        <div className="border-border relative flex flex-col items-center border px-6 py-20 text-center">
          <Crosshairs />
          <SearchX className="text-muted size-8" />
          <p className="mt-3 font-medium">
            {scraping
              ? byCreators && !filters.topic
                ? "Fetching posts from your creators…"
                : "Fetching posts from the sources…"
              : "No posts match these filters yet"}
          </p>
          <p className="text-muted mt-1 max-w-md text-sm">
            {scraping
              ? "This usually takes under a minute. Results appear here automatically."
              : filters.topic
                ? "Try one of these shorter searches, another platform, or a longer date range."
                : "Try a broader topic, another platform, or a longer date range."}
          </p>
          {!scraping && <SuggestionChips items={suggestions(parsed)} onSearch={onSearch} />}
          {!scraping && boosted && (
            <button type="button" onClick={() => updateFilters({ creators: [] })} className="text-accent mt-4 text-sm hover:underline">
              Clear creators and search everyone
            </button>
          )}
        </div>
      ) : (
        <div className={`transition-opacity ${posts.isPlaceholderData ? "opacity-50" : ""}`}>
          {boosted ? (
            <>
              {fromCreators.length > 0 ? (
                <>
                  <SectionHeading>From your creators</SectionHeading>
                  {grid(fromCreators)}
                </>
              ) : (
                !posts.hasNextPage && (
                  <p className="text-muted mb-4 text-sm">
                    None of your selected creators&apos; posts mention “{filters.topic}” yet — showing everyone&apos;s.
                  </p>
                )
              )}
              {fromEveryone.length > 0 && (
                <>
                  <SectionHeading>From everyone</SectionHeading>
                  {grid(fromEveryone)}
                </>
              )}
            </>
          ) : groups ? (
            <>
              {groups.direct.length > 0 && (
                <>
                  {groups.related.length > 0 && <SectionHeading>Results · {insight?.corrected ?? filters.topic}</SectionHeading>}
                  {grid(groups.direct)}
                </>
              )}
              {groups.related.map((group, i) => (
                <div key={group.query} className={i > 0 || groups.direct.length ? "mt-8" : ""}>
                  <SectionHeading>Related · {group.query}</SectionHeading>
                  {grid(group.posts)}
                </div>
              ))}
            </>
          ) : (
            grid(items)
          )}
          <div ref={sentinel} className="h-px" />
          {posts.isFetchingNextPage && (
            <div className="mt-3">
              <GridSkeleton count={5} />
            </div>
          )}

          {fetchedItems.length > 0 && (
            <div className="mt-8">
              <SectionHeading>
                Just fetched · {fetchedItems.length} new post{fetchedItems.length === 1 ? "" : "s"}
                {filters.dateRange !== "all" && ` · incl. older than ${RANGE_LABELS[filters.dateRange].toLowerCase()}`}
              </SectionHeading>
              {grid(fetchedItems)}
            </div>
          )}

          {posts.hasNextPage ? (
            // Infinite scroll normally gets here first; the button covers slow connections and keyboard users.
            !posts.isFetchingNextPage && (
              <div className="flex justify-center py-8">
                <button type="button" onClick={() => fetchNextPage()} className="btn-secondary">
                  Load more <ChevronDown className="size-4" />
                </button>
              </div>
            )
          ) : (
            <div className="flex flex-col items-center gap-3 px-4 py-8 text-center">
              {moreHere?.done && (
                <p className="text-sm">
                  {moreHere.added === 0
                    ? "No new posts this time — the sources returned ones you already have."
                    : justFetched.isFetching
                      ? `Added ${moreHere.added.toLocaleString()} new post${moreHere.added === 1 ? "" : "s"} — loading them…`
                      : fetchedItems.length >= moreHere.added || filters.mediaTypes.length + filters.platforms.length === 0
                        ? `Added ${moreHere.added.toLocaleString()} new post${moreHere.added === 1 ? "" : "s"} — they're in “Just fetched” above.`
                        : `Added ${moreHere.added.toLocaleString()} new posts — ${fetchedItems.length.toLocaleString()} match your platform / format filters and are in “Just fetched” above.`}
                </p>
              )}
              <p className="text-muted text-sm">
                You&apos;ve reached the end
                {filters.dateRange !== "all" && ` of ${RANGE_LABELS[filters.dateRange].toLowerCase()}`}.
              </p>
              {filters.dateRange !== "all" && (
                <button type="button" onClick={() => updateFilters({ dateRange: "all", from: "", to: "" })} className="text-accent text-sm hover:underline">
                  Show stored posts from any time
                </button>
              )}
              {canLoadMore ? (
                exhaustedScope === moreScope ? (
                  <p className="text-muted max-w-md text-xs">
                    {filters.topic
                      ? `That's as far as ViralLens searches for “${filters.topic}”. Try a related search above for more.`
                      : "That's as far back as ViralLens fetches for these creators."}
                  </p>
                ) : (
                  <>
                    <button type="button" onClick={startLoadMore} disabled={loadingMore || scraping} className="btn-secondary">
                      {loadingMore ? <Loader2 className="size-4 animate-spin" /> : <ChevronDown className="size-4" />}
                      {loadingMore ? "Fetching more posts…" : "Load more posts"}
                    </button>
                    {loadingMore && moreHere?.jobId && <JobProgress jobId={moreHere.jobId} />}
                    {loadingMore && !filters.topic && creatorFetch.state?.more && <CreatorProgress runs={creatorFetch.state.runs} />}
                    <p className="text-muted max-w-md text-xs">
                      {loadingMore
                        ? "Usually under a minute — new posts appear right here."
                        : filters.topic
                          ? `Fetches the next posts for “${filters.topic}” from ${filters.platforms.length ? "the selected platforms" : "X, LinkedIn and Instagram"} — not the ones you already have.`
                          : `Fetches older posts from ${creatorTargets.length === 1 ? creatorTargets[0].label : `your ${creatorTargets.length} selected creators`}.`}
                    </p>
                  </>
                )
              ) : (
                <p className="text-muted max-w-md text-xs">Search a topic to fetch more posts from the sources.</p>
              )}
              {loadMore.isError && <p className="text-xs text-red-400">{loadMore.error.message}</p>}
            </div>
          )}
        </div>
      )}

      {docked && composer}
    </div>
  );
}
