"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Images, Play } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useRef, useState } from "react";
import { SaveButton } from "@/components/boards/save-button";
import { PlatformLink } from "@/components/icons/platform-link";
import { Avatar } from "@/components/post/avatar";
import { Stats } from "@/components/post/stats";
import { mediaSrc, timeAgo } from "@/lib/client/format";
import { setOpenScope } from "@/lib/client/transition";
import type { Post } from "@/lib/types";

export type CardSize = "sm" | "tall" | "featured";

export const CARD_SPAN: Record<CardSize, string> = {
  sm: "row-span-1",
  tall: "row-span-2",
  featured: "col-span-2 row-span-2",
};

/** Shared-element id linking a grid thumbnail to the detail view's media. */
export const mediaLayoutId = (postId: string, scope = "grid") => `media-${scope}-${postId}`;

interface Props {
  post: Post;
  size: CardSize;
  index?: number;
  layoutScope?: string;
}

export function PostCard({ post, size, index = 0, layoutScope = "grid" }: Props) {
  const queryClient = useQueryClient();
  const articleRef = useRef<HTMLElement>(null);
  const compact = size === "sm";

  return (
    <motion.article
      ref={articleRef}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: Math.min(index % 24, 12) * 0.025 }}
      className={`group relative ${CARD_SPAN[size]}`}
    >
      <Link
        href={`/post/${post.id}`}
        scroll={false}
        onClick={() => {
          queryClient.setQueryData(["post", post.id], post);
          setOpenScope(layoutScope);
        }}
        className="focus-visible:ring-accent block h-full w-full rounded-[10px] transition duration-300 ease-out hover:-translate-y-0.5 hover:shadow-[0_24px_50px_-20px_rgba(0,0,0,0.9)] focus-visible:ring-2 focus-visible:outline-none"
        aria-label={`${post.authorName}: ${post.caption.slice(0, 80)}`}
      >
        <motion.div
          layoutId={mediaLayoutId(post.id, layoutScope)}
          style={{ borderRadius: 10 }}
          onLayoutAnimationStart={() => articleRef.current?.style.setProperty("z-index", "30")}
          onLayoutAnimationComplete={() => articleRef.current?.style.removeProperty("z-index")}
          className="bg-surface-2 relative h-full w-full overflow-hidden"
        >
          <CardMedia post={post} compact={compact} />
        </motion.div>

        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[10px] ring-1 ring-white/[0.06] transition ring-inset group-hover:ring-white/[0.14]">
          {post.mediaType === "carousel" && <Images className="absolute top-4 right-12 size-4 text-white drop-shadow" />}
          {post.mediaType === "video" && (
            <span className="absolute top-3.5 right-12 grid size-5 place-items-center rounded-full bg-white/85 text-black">
              <Play className="size-3 fill-current" />
            </span>
          )}

          {post.mediaType !== "text" && (
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/35 to-transparent px-3 pt-10 pb-2.5 text-white">
              {!compact && <p className="mb-2 line-clamp-2 text-[13px] leading-snug text-white/90">{post.caption}</p>}
              <div className="flex items-center gap-2">
                <Avatar src={post.authorAvatarUrl} name={post.authorName} className="size-6" />
                <span className="min-w-0 flex-1 truncate text-xs font-medium">{post.authorName}</span>
                <span className="text-[11px] text-white/70">{timeAgo(post.publishedAt)}</span>
              </div>
              <Stats post={post} showViews={!compact} className="mt-1.5 text-[11px] text-white/85" />
            </div>
          )}
          {post.mediaType === "text" && (
            <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 px-3 pb-2.5 text-white">
              <Avatar src={post.authorAvatarUrl} name={post.authorName} className="size-6" />
              <span className="min-w-0 flex-1 truncate text-xs font-medium">{post.authorName}</span>
              <Stats post={post} showViews={false} className="text-[11px] text-white/85" />
            </div>
          )}
        </div>
      </Link>

      <PlatformLink post={post} className="absolute top-2.5 left-2.5 size-7" />
      <SaveButton
        postId={post.id}
        className="absolute top-2 right-2 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
      />
    </motion.article>
  );
}

// Neutral-to-navy gradients for text-only posts, matching the monochrome + electric-blue system.
const TEXT_GRADIENTS = [
  "from-[#0b0b0b] to-[#232323]",
  "from-[#061029] to-[#123a7a]",
  "from-[#141414] to-[#2b2b2b]",
  "from-[#0a235c] to-[#1466ff]/70",
  "from-[#101010] to-[#0d2350]",
];

export function textGradient(id: string) {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return TEXT_GRADIENTS[h % TEXT_GRADIENTS.length];
}

function CardMedia({ post, compact }: { post: Post; compact: boolean }) {
  const [failed, setFailed] = useState(false);
  const image = post.thumbnailUrl ?? (post.mediaType !== "video" ? post.mediaUrls[0] : undefined);

  if (post.mediaType === "text" || (failed && post.mediaType !== "video")) {
    return (
      <div className={`flex h-full w-full bg-gradient-to-br p-4 pt-12 pb-12 text-white ${textGradient(post.id)}`}>
        <p className={`${compact ? "line-clamp-2 text-sm" : "line-clamp-[7] text-[15px]"} leading-snug font-medium`}>{post.caption}</p>
      </div>
    );
  }

  if (!image && post.mediaType === "video" && post.mediaUrls[0]) {
    return (
      <video
        src={mediaSrc(post.mediaUrls[0])}
        muted
        playsInline
        loop
        preload="metadata"
        onMouseEnter={(e) => void e.currentTarget.play().catch(() => {})}
        onMouseLeave={(e) => e.currentTarget.pause()}
        className="h-full w-full object-cover"
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={mediaSrc(image)}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      draggable={false}
      onError={() => setFailed(true)}
      className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
    />
  );
}
