"use client";

import { PLATFORM_LABELS } from "@/lib/client/filters";
import type { Post } from "@/lib/types";
import { PLATFORM_COLORS, PlatformIcon } from "./platform-icon";

interface Props {
  post: Pick<Post, "platform" | "postUrl">;
  className?: string;
  iconClassName?: string;
  /** Show the platform name next to the icon. */
  label?: boolean;
}

/** Platform badge that opens the original post on X / LinkedIn / Instagram in a new tab. */
export function PlatformLink({ post, className = "", iconClassName = "size-3.5", label = false }: Props) {
  const name = PLATFORM_LABELS[post.platform];
  return (
    <a
      href={post.postUrl}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      title={`Open original post on ${name}`}
      aria-label={`Open original post on ${name}`}
      className={`pointer-events-auto flex items-center justify-center gap-1.5 rounded-full shadow-md transition hover:scale-110 hover:shadow-lg ${PLATFORM_COLORS[post.platform]} ${className}`}
    >
      <PlatformIcon platform={post.platform} className={iconClassName} />
      {label && name}
    </a>
  );
}
