"use client";

import { CircleCheck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { AsciiIcon, type AsciiShape } from "@/components/ui/ascii-icon";
import { ChamferCard, Reveal } from "@/components/ui/primitives";

type Focus = "create" | "grow";

const AUDIENCES: {
  name: string;
  tagline: string;
  shape: AsciiShape;
  headline: Record<Focus, string>;
  unit: string;
  features: string[];
  cta: string;
  href: string;
  highlight?: boolean;
}[] = [
  {
    name: "Creators",
    tagline: "For solo creators hunting their next hook.",
    shape: "flame",
    headline: { create: "Hooks", grow: "Reach" },
    unit: "/ that stop the scroll",
    features: [
      "Cross-platform explore feed",
      "Virality & trending scores",
      "AI “why it worked” breakdowns",
      "Similar-post discovery",
      "CSV export",
    ],
    cta: "Start exploring",
    href: "/explore",
  },
  {
    name: "Marketers",
    tagline: "For brand teams building a repeatable playbook.",
    shape: "sparkle",
    headline: { create: "Formats", grow: "Pipeline" },
    unit: "/ proven in your niche",
    features: [
      "Everything for creators",
      "Boards to organize swipe files",
      "Topic trend timeline",
      "Filter by format & date",
      "Shareable post links",
    ],
    cta: "Create a board",
    href: "/boards",
    highlight: true,
  },
  {
    name: "Agencies",
    tagline: "For teams monitoring many clients at once.",
    shape: "bell",
    headline: { create: "Signals", grow: "Clients" },
    unit: "/ before they peak",
    features: [
      "Everything for marketers",
      "Watched topics per client",
      "Scheduled re-scraping",
      "Email alerts on spikes",
      "MySQL-backed workspace",
    ],
    cta: "Set up alerts",
    href: "/watches",
  },
];

export function Audiences() {
  const [focus, setFocus] = useState<Focus>("create");

  return (
    <section className="mx-auto max-w-[1440px] px-5 pb-24 sm:px-8 sm:pb-32 lg:px-10">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <Reveal className="max-w-2xl">
          <h2 className="display text-[34px] sm:text-[44px]">
            Built for everyone who
            <br />
            <b>creates for the feed</b>
          </h2>
          <p className="text-muted mt-5 max-w-xl text-base leading-relaxed">
            Every workspace runs the full research engine. Use it to find what to post next, or to prove what&apos;s already working.
          </p>
        </Reveal>
        <div className="border-border flex rounded-md border p-1 text-sm">
          {(["create", "grow"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFocus(f)}
              className={`flex items-center gap-2 rounded px-4 py-1.5 font-medium transition ${focus === f ? "bg-surface-2 text-foreground" : "text-muted"}`}
            >
              {f === "create" ? "Create" : "Grow"}
              {f === "grow" && <span className="bg-accent rounded-sm px-1.5 py-px text-[10px] font-semibold text-white">new</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-12 grid gap-5 lg:grid-cols-3">
        {AUDIENCES.map((audience, i) => (
          <Reveal key={audience.name} delay={i * 0.08} className="h-full">
            <ChamferCard highlight={audience.highlight} className="h-full" innerClassName="flex flex-col p-7">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="flex items-center gap-2 text-lg font-semibold">
                    {audience.name}
                    {audience.highlight && (
                      <span className="bg-accent rounded-sm px-1.5 py-0.5 text-[11px] font-medium text-white">For teams</span>
                    )}
                  </h3>
                  <p className="text-muted mt-2 text-sm">{audience.tagline}</p>
                </div>
                <AsciiIcon shape={audience.shape} size={64} />
              </div>

              <p className="mt-10 flex items-baseline gap-2">
                <span className="text-[44px] leading-none font-semibold tracking-tight">{audience.headline[focus]}</span>
                <span className="text-muted text-sm">{audience.unit}</span>
              </p>
              <p className="text-muted mt-2 text-xs">included in every workspace</p>

              <div className="border-border mt-8 border-t pt-7">
                <ul className="space-y-3.5">
                  {audience.features.map((feature) => (
                    <li key={feature} className="text-foreground/85 flex items-center gap-3 text-[14.5px]">
                      <CircleCheck className="text-accent size-[18px] shrink-0" strokeWidth={1.75} />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>

              <Link href={audience.href} className={`${audience.highlight ? "btn-primary" : "btn-secondary"} mt-10 w-full`}>
                {audience.cta}
              </Link>
            </ChamferCard>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
