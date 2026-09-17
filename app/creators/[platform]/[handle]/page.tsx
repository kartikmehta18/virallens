"use client";

import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import { ArrowLeft, ExternalLink, Loader2, RefreshCw, Users } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { SaveCreatorButton } from "@/components/creators/save-creator-button";
import { BentoGrid, GridSkeleton, featuredThreshold } from "@/components/grid/bento-grid";
import { PlatformIcon } from "@/components/icons/platform-icon";
import { Avatar } from "@/components/post/avatar";
import { segmentClass } from "@/components/ui/form";
import { Crosshairs } from "@/components/ui/primitives";
import { api } from "@/lib/client/api";
import { DEFAULT_FILTERS, PLATFORM_LABELS, SORT_LABELS, filtersToParams } from "@/lib/client/filters";
import { formatCount, timeAgo } from "@/lib/client/format";
import { useCreatorMutations, useCreatorProfile } from "@/lib/client/hooks";
import { usePreferences } from "@/lib/client/preferences";
import { creatorKey, parseCreatorKey } from "@/lib/creators";
import type { CreatorRef, PostPage, SortKey } from "@/lib/types";

const PAGE_SIZE = 24;
const PROFILE_SORTS: SortKey[] = ["newest", "trending", "engagement", "likes"];

export default function CreatorProfilePage() {
  const params = useParams<{ platform: string; handle: string }>();
  const ref = parseCreatorKey(`${params.platform}:${decodeURIComponent(params.handle)}`);

  if (!ref) {
    return (
      <div className="mx-auto max-w-md px-6 py-24 text-center">
        <p className="font-medium">This creator link isn&apos;t valid.</p>
        <Link href="/creators" className="text-accent mt-4 inline-block text-sm">
          Back to creators
        </Link>
      </div>
    );
  }
  return <CreatorProfileView key={creatorKey(ref)} creatorRef={ref} />;
}

function CreatorProfileView({ creatorRef }: { creatorRef: CreatorRef }) {
  const [prefs] = usePreferences();
  const [sort, setSort] = useState<SortKey>("newest");
  const { data: profile, isLoading: profileLoading } = useCreatorProfile(creatorRef);
  const { fetchPosts } = useCreatorMutations();
  const [fetchMessage, setFetchMessage] = useState<string | null>(null);

  const apiParams = filtersToParams({ ...DEFAULT_FILTERS, sort: [sort], creators: [creatorKey(creatorRef)] }).toString();
  const posts = useInfiniteQuery({
    queryKey: ["creator-posts", apiParams],
    queryFn: ({ pageParam }) => api<PostPage>(`/api/posts?${apiParams}&page=${pageParam}&limit=${PAGE_SIZE}`),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    placeholderData: keepPreviousData,
  });

  const runFetch = (force: boolean) => {
    setFetchMessage(null);
    fetchPosts.mutate(
      { ...creatorRef, name: profile?.name, avatarUrl: profile?.avatarUrl, force },
      {
        onSuccess: (result) =>
          setFetchMessage(
            result.status === "cached"
              ? "Already up to date"
              : `${result.postsFound} post${result.postsFound === 1 ? "" : "s"} fetched${result.source === "demo" ? " (demo data)" : ""}`,
          ),
        onError: (error) => setFetchMessage(error.message),
      },
    );
  };

  // First visit to a creator with nothing stored: pull their posts automatically.
  const autoFetched = useRef(false);
  useEffect(() => {
    if (autoFetched.current || !profile || profile.stats.postCount > 0) return;
    autoFetched.current = true;
    runFetch(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  const items = useMemo(() => posts.data?.pages.flatMap((p) => p.items) ?? [], [posts.data]);
  const threshold = useMemo(() => featuredThreshold(posts.data?.pages[0]?.items ?? []), [posts.data?.pages]);

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

  const name = profile?.name ?? creatorRef.handle;
  const stats = profile?.stats;

  return (
    <div className="mx-auto max-w-[1600px] px-5 py-8 sm:px-8 sm:py-10 lg:px-10">
      <Link href="/creators" className="text-muted hover:text-foreground inline-flex items-center gap-1.5 text-sm">
        <ArrowLeft className="size-4" /> All creators
      </Link>

      <section className="border-border bg-surface relative mt-5 border p-5 sm:p-7">
        <Crosshairs />
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-4">
            {profileLoading ? (
              <div className="skeleton size-16 shrink-0 rounded-full sm:size-20" />
            ) : (
              <div className="relative shrink-0">
                <Avatar src={profile?.avatarUrl ?? null} name={name} className="size-16 text-xl sm:size-20" />
                <span className="bg-background border-border absolute -right-0.5 -bottom-0.5 grid size-7 place-items-center rounded-full border">
                  <PlatformIcon platform={creatorRef.platform} className="size-3.5" />
                </span>
              </div>
            )}
            <div className="min-w-0">
              <h1 className="display truncate text-[26px] sm:text-[36px]">
                <b>{name}</b>
              </h1>
              <p className="text-muted mt-1 flex flex-wrap items-center gap-x-2 text-[14px]">
                <span className="truncate">@{creatorRef.handle}</span>
                <span aria-hidden>·</span>
                <span>{PLATFORM_LABELS[creatorRef.platform]}</span>
                {stats?.lastPostAt && (
                  <>
                    <span aria-hidden className="hidden sm:inline">
                      ·
                    </span>
                    <span className="basis-full sm:basis-auto">last post {timeAgo(stats.lastPostAt)} ago</span>
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
            {profile && (
              <SaveCreatorButton
                className="px-3 whitespace-nowrap sm:px-5"
                creator={{ ...creatorRef, name, avatarUrl: profile.avatarUrl }}
              />
            )}
            <button
              onClick={() => runFetch(true)}
              disabled={fetchPosts.isPending}
              className="btn-secondary h-9 px-3 whitespace-nowrap sm:px-5"
            >
              {fetchPosts.isPending ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
              {fetchPosts.isPending ? "Fetching…" : "Fetch posts"}
            </button>
            {profile && (
              <a
                href={profile.profileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary col-span-2 h-9 whitespace-nowrap"
              >
                View on {PLATFORM_LABELS[creatorRef.platform]} <ExternalLink className="size-3.5" />
              </a>
            )}
          </div>
        </div>

        {fetchMessage && (
          <p className="text-muted mt-4 text-[13px]" aria-live="polite">
            {fetchMessage}
          </p>
        )}

        <dl className="border-border mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-md border bg-[var(--border)] sm:grid-cols-3 lg:grid-cols-6">
          {[
            ["Posts tracked", stats ? formatCount(stats.postCount) : "—"],
            ["Total likes", stats ? formatCount(stats.totalLikes) : "—"],
            ["Comments", stats ? formatCount(stats.totalComments) : "—"],
            ["Shares", stats ? formatCount(stats.totalShares) : "—"],
            ["Avg. engagement", stats ? formatCount(Math.round(stats.avgEngagement)) : "—"],
            ["Best trending", stats ? (stats.bestTrending >= 10 ? formatCount(stats.bestTrending) : stats.bestTrending.toFixed(2)) : "—"],
          ].map(([label, value]) => (
            <div key={label} className="bg-surface min-w-0 px-4 py-3">
              <dd className="text-[20px] font-semibold tabular-nums">{value}</dd>
              <dt className="text-muted truncate text-[12px]">{label}</dt>
            </div>
          ))}
        </dl>
      </section>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted text-sm">
          {posts.isSuccess && `${(posts.data.pages[0]?.total ?? 0).toLocaleString()} posts`}
          {posts.isFetching && !posts.isFetchingNextPage && <Loader2 className="ml-2 inline size-4 animate-spin" />}
        </p>
        <div className="border-border no-scrollbar flex max-w-full overflow-x-auto rounded-md border p-1">
          {PROFILE_SORTS.map((key) => (
            <button key={key} onClick={() => setSort(key)} className={`${segmentClass(sort === key)} shrink-0 whitespace-nowrap`}>
              {SORT_LABELS[key]}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4">
        {posts.isLoading ? (
          <GridSkeleton count={10} />
        ) : items.length ? (
          <div className={`transition-opacity ${posts.isPlaceholderData ? "opacity-50" : ""}`}>
            <BentoGrid posts={items} threshold={threshold} layoutScope="creator" density={prefs.density} />
            <div ref={sentinel} className="h-px" />
            {posts.isFetchingNextPage && (
              <div className="flex justify-center py-6">
                <Loader2 className="text-muted size-5 animate-spin" />
              </div>
            )}
          </div>
        ) : (
          <div className="border-border relative flex flex-col items-center border px-6 py-20 text-center">
            <Crosshairs />
            {fetchPosts.isPending ? <Loader2 className="text-muted size-7 animate-spin" /> : <Users className="text-muted size-7" />}
            <p className="mt-4 font-medium">{fetchPosts.isPending ? `Fetching @${creatorRef.handle}'s posts…` : "No posts stored yet"}</p>
            {!fetchPosts.isPending && (
              <button onClick={() => runFetch(true)} className="btn-secondary mt-6">
                <RefreshCw className="size-4" /> Fetch latest posts
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
