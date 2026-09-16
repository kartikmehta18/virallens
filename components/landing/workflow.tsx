"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { AsciiIcon, type AsciiShape } from "@/components/ui/ascii-icon";
import { CrossMark, Reveal } from "@/components/ui/primitives";

const STEPS: { shape: AsciiShape; label: string; title: string; text: string }[] = [
  {
    shape: "eye",
    label: "Search",
    title: "Step 01",
    text: "Type any topic, niche or hashtag. ViralLens pulls the top posts from X, LinkedIn and Instagram and ranks them on one virality score.",
  },
  {
    shape: "sparkle",
    label: "Analyze",
    title: "Step 02",
    text: "Open a post and the media grows into a full breakdown — stats, similar posts, and an AI read on the hook, format and CTA that made it work.",
  },
  {
    shape: "bookmark",
    label: "Save & remix",
    title: "Step 03",
    text: "Save winners into boards, watch the topics you care about, and get an alert the moment the next post starts to take off.",
  },
];

export function Workflow() {
  const [[index, direction], setState] = useState<[number, number]>([0, 1]);
  const go = (delta: number) => setState(([i]) => [(i + delta + STEPS.length) % STEPS.length, delta]);
  const step = STEPS[index];

  useEffect(() => {
    const timer = setInterval(() => setState(([i]) => [(i + 1) % STEPS.length, 1]), 7000);
    return () => clearInterval(timer);
  }, [index]);

  return (
    <section className="mx-auto max-w-[1440px] px-5 pb-24 sm:px-8 sm:pb-32 lg:px-10">
      <Reveal className="grid overflow-hidden lg:grid-cols-[minmax(0,560px)_1fr]">
        <div className="border-border relative grid aspect-square place-items-center overflow-hidden bg-[radial-gradient(circle_at_50%_45%,color-mix(in_oklab,var(--accent)_16%,transparent),transparent_62%)] lg:border-r">
          <AnimatePresence mode="wait">
            <motion.div
              key={step.shape}
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.04 }}
              transition={{ duration: 0.45 }}
            >
              <AsciiIcon shape={step.shape} size={320} />
            </motion.div>
          </AnimatePresence>
          <CrossMark className="-right-[5px] bottom-0 hidden lg:block" />
        </div>

        <div className="flex flex-col justify-between gap-10 py-10 lg:pl-12">
          <div className="min-h-[220px]">
            <p className="text-muted mb-6 text-sm font-medium">How ViralLens works</p>
            <AnimatePresence mode="wait" custom={direction}>
              <motion.p
                key={index}
                initial={{ opacity: 0, x: direction * 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: direction * -24 }}
                transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                className="text-[26px] leading-snug tracking-tight sm:text-[34px]"
              >
                {step.text}
              </motion.p>
            </AnimatePresence>
          </div>

          <div className="flex items-end justify-between gap-6">
            <div className="flex items-center gap-3">
              <button onClick={() => go(-1)} aria-label="Previous step" className="btn-secondary size-10 px-0">
                <ArrowLeft className="size-4" />
              </button>
              <button onClick={() => go(1)} aria-label="Next step" className="btn-secondary size-10 px-0">
                <ArrowRight className="size-4" />
              </button>
              <div className="ml-2 flex items-center gap-1.5">
                {STEPS.map((s, i) => (
                  <button
                    key={s.label}
                    onClick={() => setState([i, i > index ? 1 : -1])}
                    aria-label={`Go to ${s.label}`}
                    className={`h-1.5 transition-all ${i === index ? "bg-accent w-5" : "bg-border w-1.5"}`}
                  />
                ))}
              </div>
            </div>
            <div className="text-right">
              <p className="text-[15px] font-semibold">{step.label}</p>
              <p className="text-muted text-sm">{step.title}</p>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
