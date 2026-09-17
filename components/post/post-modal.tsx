"use client";

import { X } from "lucide-react";
import { motion, useDragControls, type PanInfo } from "motion/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Post } from "@/lib/types";
import { PostDetail } from "./post-detail";

/**
 * Overlay rendered by the intercepted /post/[id] route. The grid stays mounted underneath;
 * the media grows out of the clicked card via a shared layoutId and shrinks back on close.
 */
export function PostModal({ id }: { id: string }) {
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragControls = useDragControls();
  const [closing, setClosing] = useState(false);

  const close = useCallback(() => {
    if (closing) return;
    setClosing(true);
    // Let the backdrop and panels fade first; then the media animates back into its grid card on unmount.
    setTimeout(() => router.back(), 170);
  }, [closing, router]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  useEffect(() => {
    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      root.style.overflow = previous;
    };
  }, []);

  const selectSimilar = (post: Post) => {
    scrollRef.current?.scrollTo({ top: 0 });
    router.replace(`/post/${post.id}`, { scroll: false });
  };

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > 140 || info.velocity.y > 600) close();
  };

  return (
    <div className="fixed inset-0 z-50">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: closing ? 0 : 1 }}
        transition={{ duration: closing ? 0.17 : 0.25 }}
        className="absolute inset-0 bg-black/85 backdrop-blur-md"
        aria-hidden
      />

      <motion.div
        ref={scrollRef}
        layoutScroll
        className="no-scrollbar absolute inset-0 overflow-y-auto overscroll-contain"
        onClick={(e) => e.target === e.currentTarget && close()}
      >
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: closing ? 0 : 1 }}
          onClick={close}
          className="fixed top-5 right-5 z-10 hidden size-10 place-items-center rounded-md border border-white/10 bg-white/5 text-white backdrop-blur transition hover:bg-white/10 lg:grid"
          aria-label="Close"
        >
          <X className="size-5" />
        </motion.button>

        <div className="flex min-h-full justify-center px-0 py-0 sm:px-6 sm:py-8" onClick={(e) => e.target === e.currentTarget && close()}>
          <motion.div
            role="dialog"
            aria-modal="true"
            drag="y"
            dragControls={dragControls}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={onDragEnd}
            className="relative isolate w-full max-w-[1240px] p-3 pt-0 sm:p-5"
            style={{ touchAction: "pan-y" }}
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: closing ? 0 : 1 }}
              transition={{ duration: 0.2 }}
              className="bg-background absolute inset-0 -z-10 sm:rounded-2xl"
            />
            {/* Swipe-down handle (mobile) */}
            <div
              onPointerDown={(e) => dragControls.start(e)}
              className="bg-background/90 sticky top-0 z-10 -mx-3 flex cursor-grab items-center justify-between px-3 py-2 backdrop-blur sm:hidden"
              style={{ touchAction: "none" }}
            >
              <span className="bg-border mx-auto h-1.5 w-12 rounded-full" />
              <button
                onClick={close}
                className="bg-surface-2 absolute right-3 grid size-8 place-items-center rounded-full"
                aria-label="Close"
              >
                <X className="size-4" />
              </button>
            </div>
            <PostDetail id={id} mode="modal" closing={closing} onClose={close} onSelectSimilar={selectSimilar} />
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}
