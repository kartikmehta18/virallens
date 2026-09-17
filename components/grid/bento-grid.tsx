"use client";

import type { Post } from "@/lib/types";
import { PostCard, type CardSize } from "./post-card";

function hash(value: string) {
  let h = 0;
  for (const c of value) h = (h * 33 + c.charCodeAt(0)) >>> 0;
  return h;
}

/** Engagement score above which a card is "featured" (2×2). Computed from the first page so sizes don't shift while scrolling. */
export function featuredThreshold(posts: Post[]): number {
  if (posts.length < 6) return Infinity;
  const scores = posts.map((p) => p.engagementScore).sort((a, b) => b - a);
  return scores[Math.max(0, Math.floor(scores.length * 0.1) - 1)];
}

export function cardSize(post: Post, threshold: number): CardSize {
  if (post.engagementScore >= threshold) return "featured";
  if (post.mediaType === "video" || post.mediaType === "carousel") return "tall";
  if (post.mediaType === "text") return post.caption.length > 160 ? "tall" : "sm";
  return hash(post.id) % 3 === 0 ? "sm" : "tall";
}

interface Props {
  posts: Post[];
  threshold?: number;
  layoutScope?: string;
  density?: "comfortable" | "compact";
}

export function BentoGrid({ posts, threshold, layoutScope, density = "comfortable" }: Props) {
  const limit = threshold ?? featuredThreshold(posts);
  return (
    <div className={density === "compact" ? "bento bento-compact" : "bento"}>
      {posts.map((post, index) => (
        <PostCard key={post.id} post={post} size={cardSize(post, limit)} index={index} layoutScope={layoutScope} />
      ))}
    </div>
  );
}

const SKELETON_SIZES: CardSize[] = ["featured", "tall", "sm", "tall", "sm", "tall", "tall", "sm", "featured", "sm", "tall", "sm"];

export function GridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div className="bento" aria-busy="true" aria-label="Loading posts">
      {Array.from({ length: count }, (_, i) => {
        const size = SKELETON_SIZES[i % SKELETON_SIZES.length];
        return (
          <div
            key={i}
            className={`skeleton rounded-[10px] ${size === "featured" ? "col-span-2 row-span-2" : size === "tall" ? "row-span-2" : "row-span-1"}`}
          />
        );
      })}
    </div>
  );
}
