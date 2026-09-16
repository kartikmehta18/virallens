"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { AnimatePresence, motion, type PanInfo } from "motion/react";
import { useState } from "react";
import { textGradient } from "@/components/grid/post-card";
import { mediaSrc } from "@/lib/client/format";
import type { Post } from "@/lib/types";

interface Props {
  post: Post;
  layoutId: string;
  className?: string;
}

/** Large media area of the detail view. The outer element carries the shared layoutId for the grow-in transition. */
export function MediaViewer({ post, layoutId, className = "" }: Props) {
  return (
    <motion.div
      layoutId={layoutId}
      style={{ borderRadius: 12 }}
      transition={{ type: "spring", stiffness: 320, damping: 34 }}
      className={`relative overflow-hidden bg-black ${className}`}
    >
      {post.mediaType === "text" && <TextMedia post={post} />}
      {post.mediaType === "image" && <ImageMedia src={post.mediaUrls[0] ?? post.thumbnailUrl} />}
      {post.mediaType === "video" && <VideoMedia post={post} />}
      {post.mediaType === "carousel" && <CarouselMedia urls={post.mediaUrls} />}
    </motion.div>
  );
}

function TextMedia({ post }: { post: Post }) {
  return (
    <div className={`flex h-full w-full items-center justify-center bg-gradient-to-br p-8 sm:p-14 ${textGradient(post.id)}`}>
      <p className="no-scrollbar max-h-full overflow-y-auto text-lg leading-relaxed font-medium whitespace-pre-line text-white sm:text-2xl">
        {post.caption}
      </p>
    </div>
  );
}

function ImageMedia({ src }: { src: string | null | undefined }) {
  const url = mediaSrc(src);
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt=""
        aria-hidden
        referrerPolicy="no-referrer"
        className="absolute inset-0 h-full w-full scale-110 object-cover opacity-40 blur-2xl"
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="" referrerPolicy="no-referrer" draggable={false} className="relative h-full w-full object-contain" />
    </>
  );
}

function VideoMedia({ post }: { post: Post }) {
  return (
    <video
      key={post.mediaUrls[0]}
      src={mediaSrc(post.mediaUrls[0])}
      poster={mediaSrc(post.thumbnailUrl)}
      autoPlay
      muted
      loop
      playsInline
      controls
      className="h-full w-full object-contain"
    />
  );
}

function CarouselMedia({ urls }: { urls: string[] }) {
  const [[index, direction], setState] = useState<[number, number]>([0, 0]);
  const go = (delta: number) => {
    const next = index + delta;
    if (next >= 0 && next < urls.length) setState([next, delta]);
  };
  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x < -60 || info.velocity.x < -400) go(1);
    else if (info.offset.x > 60 || info.velocity.x > 400) go(-1);
  };

  return (
    <div className="relative h-full w-full">
      <AnimatePresence initial={false} custom={direction} mode="popLayout">
        <motion.div
          key={index}
          custom={direction}
          initial={{ x: direction >= 0 ? "100%" : "-100%", opacity: 0.6 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: direction >= 0 ? "-100%" : "100%", opacity: 0.6 }}
          transition={{ type: "spring", stiffness: 380, damping: 38 }}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.25}
          onDragEnd={onDragEnd}
          className="absolute inset-0 cursor-grab active:cursor-grabbing"
        >
          <ImageMedia src={urls[index]} />
        </motion.div>
      </AnimatePresence>

      {index > 0 && (
        <button
          onClick={() => go(-1)}
          aria-label="Previous"
          className="absolute top-1/2 left-3 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-white/85 text-black shadow"
        >
          <ChevronLeft className="size-5" />
        </button>
      )}
      {index < urls.length - 1 && (
        <button
          onClick={() => go(1)}
          aria-label="Next"
          className="absolute top-1/2 right-3 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-white/85 text-black shadow"
        >
          <ChevronRight className="size-5" />
        </button>
      )}
      <div className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
        {urls.map((url, i) => (
          <button
            key={url + i}
            onClick={() => setState([i, i > index ? 1 : -1])}
            aria-label={`Slide ${i + 1}`}
            className={`h-1.5 rounded-full transition-all ${i === index ? "w-5 bg-white" : "w-1.5 bg-white/50"}`}
          />
        ))}
      </div>
    </div>
  );
}
