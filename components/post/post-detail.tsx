"use client";

import { ExternalLink, Flame, TrendingUp, X as CloseIcon } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { Fragment, useState } from "react";
import { SaveButton } from "@/components/boards/save-button";
import { SaveCreatorButton } from "@/components/creators/save-creator-button";
import { mediaLayoutId } from "@/components/grid/post-card";
import { PlatformLink } from "@/components/icons/platform-link";
import { formatCount, ago, timeAgo } from "@/lib/client/format";
import { creatorPath } from "@/lib/creators";
import { usePost } from "@/lib/client/hooks";
import { getOpenScope } from "@/lib/client/transition";
import type { Post } from "@/lib/types";
import { AiBreakdown } from "./ai-breakdown";
import { Avatar } from "./avatar";
import { MediaViewer } from "./media-viewer";
import { SimilarRail } from "./similar-rail";

interface Props {
  id: string;
  initialPost?: Post;
  /** "modal" hides chrome that the modal provides and fades side content during close. */
  mode: "modal" | "page";
  closing?: boolean;
  onClose?: () => void;
  onSelectSimilar: (post: Post) => void;
}

export function PostDetail({ id, initialPost, mode, closing = false, onClose, onSelectSimilar }: Props) {
  const { data: post, isError } = usePost(id, initialPost);
  // Captured once per post id so the media reuses the layoutId of the thumbnail that was clicked.
  const [opened, setOpened] = useState(() => ({ id, scope: mode === "modal" ? getOpenScope() : "page" }));
  if (opened.id !== id) setOpened({ id, scope: mode === "modal" ? getOpenScope() : "page" });
  const scope = opened.scope;
  const fade = { animate: { opacity: closing ? 0 : 1 }, transition: { duration: 0.18 } };

  if (isError) {
    return (
      <div className="bg-surface rounded-xl p-10 text-center">
        <p className="font-medium">This post could not be loaded.</p>
        {onClose && (
          <button onClick={onClose} className="bg-foreground text-background mt-4 rounded-full px-4 py-2 text-sm">
            Close
          </button>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(340px,1fr)] lg:gap-6">
        {post ? (
          <MediaViewer
            key={post.id}
            post={post}
            layoutId={mediaLayoutId(post.id, scope)}
            className="aspect-[4/5] max-h-[62vh] w-full sm:aspect-auto sm:h-[min(78vh,760px)] sm:max-h-none"
          />
        ) : (
          <div className="skeleton aspect-[4/5] max-h-[62vh] w-full rounded-xl sm:aspect-auto sm:h-[min(78vh,760px)]" />
        )}

        <motion.aside
          initial={mode === "modal" ? { opacity: 0, x: 24 } : false}
          animate={{ opacity: closing ? 0 : 1, x: 0 }}
          transition={{ duration: 0.28, delay: closing ? 0 : 0.08 }}
          className="border-border bg-surface flex min-h-0 flex-col rounded-xl border shadow-2xl lg:h-[min(78vh,760px)]"
        >
          {post ? <SidePanel post={post} mode={mode} onClose={onClose} /> : <SidePanelSkeleton />}
        </motion.aside>
      </div>

      <motion.div {...fade}>
        <SimilarRail key={id} postId={id} onSelect={onSelectSimilar} />
      </motion.div>
    </div>
  );
}

function SidePanel({ post, mode, onClose }: { post: Post; mode: Props["mode"]; onClose?: () => void }) {
  return (
    <>
      <header className="border-border flex items-center gap-3 border-b p-3 sm:p-4">
        <Link
          href={creatorPath({ platform: post.platform, handle: post.authorHandle })}
          className="group/author flex min-w-0 flex-1 items-center gap-3"
          title="View creator profile"
        >
          <Avatar src={post.authorAvatarUrl} name={post.authorName} className="size-10" />
          <div className="min-w-0 flex-1">
            <p className="truncate leading-tight font-semibold group-hover/author:underline">{post.authorName}</p>
            <p className="text-muted flex items-center gap-1.5 truncate text-xs">
              @{post.authorHandle} · {ago(post.publishedAt)}
            </p>
          </div>
        </Link>
        <SaveCreatorButton
          variant="icon"
          creator={{ platform: post.platform, handle: post.authorHandle, name: post.authorName, avatarUrl: post.authorAvatarUrl }}
        />
        <PlatformLink post={post} label className="h-7 px-2.5 text-xs font-medium shadow-none hover:scale-105" />
        {mode === "modal" && onClose && (
          <button
            onClick={onClose}
            className="text-muted hover:bg-surface-2 hover:text-foreground hidden size-8 place-items-center rounded-full lg:grid"
            aria-label="Close"
          >
            <CloseIcon className="size-4" />
          </button>
        )}
      </header>

      <div className="no-scrollbar min-h-0 flex-1 space-y-5 overflow-y-auto p-3 sm:p-4">
        <Caption text={post.caption} />

        {post.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {post.tags.slice(0, 12).map((tag) => (
              <Link
                key={tag}
                href={`/explore?topic=${encodeURIComponent(tag)}`}
                className="border-border text-muted hover:border-foreground/30 hover:text-foreground rounded-md border px-2 py-1 text-xs transition"
              >
                #{tag}
              </Link>
            ))}
          </div>
        )}

        <div className="divide-border border-border grid grid-cols-4 divide-x rounded-md border py-3 text-center">
          {[
            ["Likes", post.likeCount],
            ["Comments", post.commentCount],
            ["Shares", post.shareCount],
            ["Views", post.viewCount],
          ].map(([label, value]) => (
            <div key={label as string}>
              <p className="text-base font-semibold tabular-nums">{value === null ? "—" : formatCount(value as number)}</p>
              <p className="text-muted text-[11px]">{label}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          <span
            className="border-border flex items-center gap-1.5 rounded-md border px-3 py-1.5"
            title="likes×1 + comments×3 + shares×5 + views×0.05"
          >
            <Flame className="text-accent size-3.5" /> Engagement {formatCount(post.engagementScore)}
          </span>
          <span className="border-border flex items-center gap-1.5 rounded-md border px-3 py-1.5" title="engagement / (hours + 2)^1.5">
            <TrendingUp className="text-accent size-3.5" /> Trending{" "}
            {post.trendingScore >= 10 ? formatCount(post.trendingScore) : post.trendingScore.toFixed(2)}
            <span className="text-muted">· {timeAgo(post.publishedAt)} old</span>
          </span>
        </div>

        <AiBreakdown post={post} />
      </div>

      <footer className="border-border flex items-center gap-2 border-t p-3">
        <SaveButton postId={post.id} variant="solid" />
        <a href={post.postUrl} target="_blank" rel="noopener noreferrer" className="btn-primary ml-auto h-9">
          Open original <ExternalLink className="size-3.5" />
        </a>
      </footer>
    </>
  );
}

/** Caption with clickable hashtags that pivot the explore search. */
function Caption({ text }: { text: string }) {
  const parts = text.split(/(#[\p{L}\p{N}_]+)/gu);
  return (
    <p className="text-[15px] leading-relaxed break-words whitespace-pre-line">
      {parts.map((part, i) =>
        part.startsWith("#") ? (
          <Link key={i} href={`/explore?topic=${encodeURIComponent(part.slice(1))}`} className="text-accent hover:underline">
            {part}
          </Link>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </p>
  );
}

function SidePanelSkeleton() {
  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center gap-3">
        <div className="skeleton size-10 rounded-full" />
        <div className="skeleton h-4 w-40 rounded" />
      </div>
      <div className="skeleton h-24 rounded-xl" />
      <div className="skeleton h-16 rounded-xl" />
    </div>
  );
}
