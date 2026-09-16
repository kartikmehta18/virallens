"use client";

import { motion, useScroll, useTransform } from "motion/react";
import { useRef } from "react";
import { Eyebrow, Reveal } from "@/components/ui/primitives";
import { mediaSrc } from "@/lib/client/format";
import { useTrendingPosts } from "./use-landing-data";

const PROBLEMS = [
  {
    title: "Scroll fatigue",
    body: "Hours of manual scrolling across three apps turn up a handful of examples — and none of the context on why they worked.",
  },
  {
    title: "Metrics that don't compare",
    body: "LinkedIn reactions, Instagram views and reposts on X live on different scales, so the real winners stay hidden.",
  },
];

export function Challenge() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], ["-8%", "8%"]);
  const { data } = useTrendingPosts(8, "image,carousel");
  const image = data?.items[3]?.thumbnailUrl ?? data?.items[0]?.thumbnailUrl;

  return (
    <section
      ref={ref}
      className="mx-auto grid max-w-[1440px] items-center gap-12 px-5 pb-24 sm:px-8 sm:pb-32 lg:grid-cols-[1fr_minmax(0,560px)] lg:px-10"
    >
      <Reveal>
        <Eyebrow>The challenge</Eyebrow>
        <h2 className="display max-w-2xl text-[34px] sm:text-[44px]">
          Posting blind costs reach, <b>but researching by hand</b> costs <b>your week</b>
        </h2>
        <div className="mt-10 max-w-2xl">
          {PROBLEMS.map((problem) => (
            <div key={problem.title} className="border-border border-t py-6">
              <h3 className="text-[15px] font-semibold">{problem.title}</h3>
              <p className="text-muted mt-2 text-[14.5px] leading-relaxed">{problem.body}</p>
            </div>
          ))}
        </div>
      </Reveal>

      <Reveal
        delay={0.1}
        className="duotone relative aspect-[4/5] w-full"
        style={{ clipPath: "polygon(0 0, 100% 0, 100% calc(100% - 22px), calc(100% - 22px) 100%, 0 100%)" }}
      >
        {image ? (
          <motion.img
            src={mediaSrc(image)}
            alt=""
            referrerPolicy="no-referrer"
            style={{ y, scale: 1.18 }}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div className="skeleton absolute inset-0" />
        )}
      </Reveal>
    </section>
  );
}
