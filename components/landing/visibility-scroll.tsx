"use client";

import { ArrowRight } from "lucide-react";
import { motion, useReducedMotion, useScroll, useTransform, type MotionValue } from "motion/react";
import Link from "next/link";
import { useRef } from "react";
import { mediaSrc } from "@/lib/client/format";
import { useTrendingPosts } from "./use-landing-data";

// Tile layout around the centre heading: [column, row] offsets.
const SLOTS: [number, number][] = [
  [-1, -1],
  [0, -1.35],
  [1, -1],
  [-1, 0.05],
  [1, 0.05],
  [-1, 1.1],
  [0, 1.25],
  [1, 1.1],
  [0, -2.6],
  [0, 2.5],
];

/** Scroll-pinned section: post thumbnails (blue duotone) spread outward from the headline as you scroll. */
export function VisibilityScroll() {
  const ref = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const { data } = useTrendingPosts(24, "image,carousel");
  const images = (data?.items ?? []).map((p) => p.thumbnailUrl ?? p.mediaUrls[0]).filter(Boolean) as string[];

  const ctaOpacity = useTransform(scrollYProgress, [0.55, 0.75], [0, 1]);
  const ctaY = useTransform(scrollYProgress, [0.55, 0.75], [16, 0]);

  return (
    <section ref={ref} className="relative h-[320vh]">
      <div className="sticky top-16 flex h-[calc(100vh-4rem)] items-center justify-center overflow-hidden">
        {SLOTS.map(([col, row], i) => (
          <Tile
            key={i}
            col={col}
            row={row}
            index={i}
            progress={scrollYProgress}
            src={images[i % Math.max(images.length, 1)]}
            still={Boolean(reduced)}
          />
        ))}

        <div className="relative z-10 px-5 text-center">
          <h2 className="display text-[40px] drop-shadow-[0_2px_24px_rgba(0,0,0,0.65)] sm:text-[56px]">
            Total <b>visibility</b> across
            <br />
            every feed you care about
          </h2>
          <motion.div style={reduced ? undefined : { opacity: ctaOpacity, y: ctaY }} className="mt-8">
            <Link href="/explore" className="btn-primary">
              Explore the platform <ArrowRight className="size-4" />
            </Link>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function Tile({
  col,
  row,
  index,
  progress,
  src,
  still,
}: {
  col: number;
  row: number;
  index: number;
  progress: MotionValue<number>;
  src?: string;
  still: boolean;
}) {
  // Start clustered behind the headline, then fly outward past the viewport edges.
  const spread = useTransform(progress, [0, 0.8], [1, 3.2]);
  const x = useTransform(spread, (s) => `${col * s * 12.5}vw`);
  const y = useTransform(spread, (s) => `${row * s * 15}vh`);
  const scale = useTransform(progress, [0, 0.8], [0.72, 1.45]);
  const opacity = useTransform(progress, [0, 0.08 + index * 0.012, 0.7, 0.9], [0, 1, 1, 0]);

  return (
    <motion.div
      style={still ? { x: `${col * 24}vw`, y: `${row * 30}vh`, opacity: 0.35 } : { x, y, scale, opacity }}
      className="duotone absolute size-[clamp(140px,17vw,250px)]"
    >
      <div
        className="absolute inset-0"
        style={{ clipPath: "polygon(0 0, 100% 0, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0 100%)" }}
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={mediaSrc(src)} alt="" referrerPolicy="no-referrer" loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <div className="bg-accent-deep h-full w-full" />
        )}
      </div>
    </motion.div>
  );
}
