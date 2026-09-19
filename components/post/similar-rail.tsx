"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Loader2, Plus, Sparkles } from "lucide-react";
import { motion } from "motion/react";
import { useMemo, useRef, useState } from "react";
import { PlatformLink } from "@/components/icons/platform-link";
import { mediaLayoutId, textGradient } from "@/components/grid/post-card";
import { api } from "@/lib/client/api";
import { formatCount, mediaSrc } from "@/lib/client/format";
import { newPostIdsOf, scrapeJobDone, useSimilarPosts } from "@/lib/client/hooks";
import { setOpenScope } from "@/lib/client/transition";
import type { Post, PostPage, ScrapeJob } from "@/lib/types";

export const SIMILAR_SCOPE = "similar";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type MoreResponse = { status: "started" | "inflight" | "cached" | "exhausted"; jobId?: string; query: string };

const tileClass =
  "border-border text-muted hover:bg-surface-2 hover:text-foreground flex aspect-[3/4] w-40 shrink-0 snap-start flex-col items-center justify-center gap-2 rounded-[10px] border border-dashed p-3 text-center text-xs transition disabled:pointer-events-none sm:w-44";

export function SimilarRail({ postId, onSelect }: { postId: string; onSelect: (post: Post) => void }) {
  const similar = useSimilarPosts(postId);
  const queryClient = useQueryClient();
  const scroller = useRef<HTMLDivElement>(null);
  // Posts that "Find more like this" fetched from the platforms, shown after the ranked ones.
  const [extra, setExtra] = useState<Post[]>([]);
  const [note, setNote] = useState<string | null>(null);

  const posts = useMemo(() => {
    const ranked = similar.data?.pages.flatMap((p) => p.items) ?? [];
    const seen = new Set(ranked.map((p) => p.id));
    return [...ranked, ...extra.filter((p) => !seen.has(p.id))];
  }, [similar.data, extra]);

  // Stored similar posts ran out: search the platforms for this post's subject (Gemini names it, cached),
  // wait for that fetch, then append the posts it added.
  const findMore = useMutation({
    mutationFn: async () => {
      const start = await api<MoreResponse>(`/api/posts/${postId}/similar/more`, { method: "POST" });
      if (!start.jobId) return { added: [] as Post[], exhausted: start.status === "exhausted" };
      let job: ScrapeJob;
      do {
        await sleep(2500);
        job = await api<ScrapeJob>(`/api/scrape/status/${start.jobId}`);
      } while (!scrapeJobDone(job));
      const ids = newPostIdsOf(job).slice(0, 60);
      const added = ids.length ? (await api<PostPage>(`/api/posts?ids=${ids.join(",")}&limit=60`)).items : [];
      return { added, exhausted: false };
    },
    onMutate: () => setNote(null),
    onSuccess: ({ added, exhausted }) => {
      setExtra((current) => [...current, ...added.filter((p) => !current.some((c) => c.id === p.id))]);
      if (!added.length) setNote(exhausted ? "That's everything we can find for now." : "No new similar posts this time.");
      if (added.length) queryClient.invalidateQueries({ queryKey: ["posts"] });
    },
    onError: (error) => setNote(error.message),
  });

  const scrollBy = (dir: number) => scroller.current?.scrollBy({ left: dir * scroller.current.clientWidth * 0.8, behavior: "smooth" });

  return (
    <section className="mt-8">
      <div className="mb-3 flex items-center gap-2">
        <h3 className="text-base font-semibold">Similar posts</h3>
        <div className="ml-auto hidden gap-1 sm:flex">
          <button
            onClick={() => scrollBy(-1)}
            className="border-border hover:bg-surface-2 grid size-8 place-items-center rounded-full border"
            aria-label="Scroll left"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            onClick={() => scrollBy(1)}
            className="border-border hover:bg-surface-2 grid size-8 place-items-center rounded-full border"
            aria-label="Scroll right"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>

      <div ref={scroller} className="no-scrollbar -mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-2">
        {similar.isLoading &&
          Array.from({ length: 6 }, (_, i) => <div key={i} className="skeleton aspect-[3/4] w-40 shrink-0 rounded-lg sm:w-44" />)}
        {posts.map((post) => (
          <div key={post.id} className="relative w-40 shrink-0 snap-start sm:w-44">
            <button
              onClick={() => {
                queryClient.setQueryData(["post", post.id], post);
                setOpenScope(SIMILAR_SCOPE);
                onSelect(post);
              }}
              className="group relative block aspect-[3/4] w-full text-left"
            >
              <motion.div
                layoutId={mediaLayoutId(post.id, SIMILAR_SCOPE)}
                style={{ borderRadius: 10 }}
                className="bg-surface-2 relative h-full w-full overflow-hidden"
              >
                {post.thumbnailUrl || (post.mediaType !== "text" && post.mediaType !== "video" && post.mediaUrls[0]) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={mediaSrc(post.thumbnailUrl ?? post.mediaUrls[0])}
                    alt=""
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div className={`h-full w-full bg-gradient-to-br p-3 pt-10 ${textGradient(post.id)}`}>
                    <p className="line-clamp-6 text-xs leading-snug font-medium text-white">{post.caption}</p>
                  </div>
                )}
              </motion.div>
              <div className="pointer-events-none absolute inset-x-0 bottom-0 rounded-b-2xl bg-gradient-to-t from-black/80 to-transparent p-2.5 pt-8 text-white">
                <p className="truncate text-xs font-medium">{post.authorName}</p>
                <p className="text-[11px] text-white/75">
                  ♥ {formatCount(post.likeCount)} · score {formatCount(post.engagementScore)}
                </p>
              </div>
            </button>
            <PlatformLink post={post} className="absolute top-2 left-2 size-6" iconClassName="size-3" />
          </div>
        ))}

        {!similar.isLoading &&
          (similar.hasNextPage ? (
            <button type="button" onClick={() => similar.fetchNextPage()} disabled={similar.isFetchingNextPage} className={tileClass}>
              {similar.isFetchingNextPage ? <Loader2 className="size-5 animate-spin" /> : <Plus className="size-5" />}
              <span className="text-foreground text-sm font-medium">Load more</span>
              <span>More posts like this one</span>
            </button>
          ) : (
            <button type="button" onClick={() => findMore.mutate()} disabled={findMore.isPending} className={tileClass}>
              {findMore.isPending ? <Loader2 className="size-5 animate-spin" /> : <Sparkles className="size-5" />}
              <span className="text-foreground text-sm font-medium">{findMore.isPending ? "Finding more…" : "Load more"}</span>
              <span>
                {findMore.isPending
                  ? "Searching X, LinkedIn and Instagram for this subject — about a minute."
                  : (note ?? (posts.length ? "Fetch new posts like this one" : "No similar posts yet — fetch some"))}
              </span>
            </button>
          ))}
      </div>
    </section>
  );
}
