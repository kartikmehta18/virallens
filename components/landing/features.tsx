"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { AsciiIcon, type AsciiShape } from "@/components/ui/ascii-icon";
import { ChamferCard, Reveal } from "@/components/ui/primitives";

const FEATURES: { title: string; body: string; label: string; href: string; shape: AsciiShape }[] = [
  {
    title: "One score, every platform",
    body: "Likes, comments, shares and views are weighted into a single time-decayed virality score — so a LinkedIn post and an Instagram reel finally compare.",
    label: "Discovery · Explore feed",
    href: "/explore",
    shape: "flame",
  },
  {
    title: "Know why it worked",
    body: "Open any post for an AI breakdown of its hook, format, call-to-action and emotional angle — the pattern you can reuse, not just the result.",
    label: "Analysis · AI breakdown",
    href: "/explore?sort=engagement",
    shape: "sparkle",
  },
  {
    title: "Catch the wave early",
    body: "Watch a topic and ViralLens re-scrapes it on a schedule, emailing you the moment a new post crosses your trending threshold.",
    label: "Monitoring · Alerts",
    href: "/watches",
    shape: "bell",
  },
];

export function Features() {
  return (
    <section className="mx-auto max-w-[1440px] px-5 pb-24 sm:px-8 sm:pb-32 lg:px-10">
      <Reveal className="max-w-3xl">
        <h2 className="display text-[34px] sm:text-[44px]">
          One platform that <b>finds</b>, <b>explains</b>, and <b>tracks</b> every viral post
        </h2>
        <p className="text-muted mt-5 max-w-xl text-base leading-relaxed">
          ViralLens collapses hours of scrolling across three apps into a single research workspace — built to discover, decode and monitor
          what your audience actually engages with.
        </p>
      </Reveal>

      <div className="mt-14 grid gap-5 lg:grid-cols-3">
        {FEATURES.map((feature, i) => (
          <Reveal key={feature.title} delay={i * 0.08} className="h-full">
            <ChamferCard className="h-full" innerClassName="flex flex-col p-7">
              <h3 className="text-lg font-semibold tracking-tight">{feature.title}</h3>
              <div className="dash-line mt-6" />
              <div className="grid flex-1 place-items-center py-10">
                <AsciiIcon shape={feature.shape} size={150} />
              </div>
              <div className="dash-line" />
              <p className="text-muted mt-6 text-[14.5px] leading-relaxed">{feature.body}</p>
              <div className="mt-8 flex items-center justify-between">
                <span className="text-foreground/80 text-[13px] font-medium">{feature.label}</span>
                <Link href={feature.href} aria-label={feature.title} className="btn-secondary size-10 px-0">
                  <ArrowRight className="size-4" />
                </Link>
              </div>
            </ChamferCard>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
