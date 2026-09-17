"use client";

import { useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { motion } from "motion/react";
import { useRef } from "react";
import { PlatformLink } from "@/components/icons/platform-link";
import { mediaLayoutId, textGradient } from "@/components/grid/post-card";
import { formatCount, mediaSrc } from "@/lib/client/format";
import { useSimilarPosts } from "@/lib/client/hooks";
import { setOpenScope } from "@/lib/client/transition";
import type { Post } from "@/lib/types";

export const SIMILAR_SCOPE = "similar";

export function SimilarRail({ postId, onSelect }: { postId: string; onSelect: (post: Post) => void }) {
  const { data: posts, isLoading } = useSimilarPosts(postId);
  const queryClient = useQueryClient();
  const scroller = useRef<HTMLDivElement>(null);

  const scrollBy = (dir: number) => scroller.current?.scrollBy({ left: dir * scroller.current.clientWidth * 0.8, behavior: "smooth" });

  if (!isLoading && !posts?.length) return null;

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
        {isLoading &&
          Array.from({ length: 6 }, (_, i) => <div key={i} className="skeleton aspect-[3/4] w-40 shrink-0 rounded-lg sm:w-44" />)}
        {posts?.map((post) => (
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
      </div>
    </section>
  );
}
