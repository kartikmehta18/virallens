"use client";

import { useState } from "react";
import { mediaSrc } from "@/lib/client/format";

export function Avatar({ src, name, className = "size-8" }: { src: string | null; name: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <span
        className={`${className} bg-surface-2 text-foreground ring-border grid shrink-0 place-items-center rounded-full text-xs font-semibold ring-1`}
      >
        {name.slice(0, 1).toUpperCase()}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={mediaSrc(src)}
      alt=""
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`${className} shrink-0 rounded-full object-cover`}
    />
  );
}
