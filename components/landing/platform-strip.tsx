"use client";

import { Radar } from "lucide-react";
import { PlatformIcon } from "@/components/icons/platform-icon";
import { Crosshairs, Reveal } from "@/components/ui/primitives";
import { PLATFORMS } from "@/lib/types";
import { PLATFORM_LABELS } from "@/lib/client/filters";

/** Framed strip of the sources ViralLens tracks (blueprint border with blue crosshairs). */
export function PlatformStrip() {
  return (
    <section className="mx-auto max-w-[1440px] px-5 pb-24 sm:px-8 lg:px-10">
      <Reveal className="border-border relative grid border-y sm:grid-cols-[210px_1fr_210px] sm:border-x">
        <Crosshairs />
        <div className="border-border text-muted flex items-center justify-center border-b px-6 py-6 text-[13px] font-medium sm:justify-start sm:border-r sm:border-b-0">
          Tracking the feeds that matter
        </div>
        <div className="flex flex-wrap items-center justify-around gap-x-10 gap-y-4 px-6 py-6">
          {PLATFORMS.map((platform) => (
            <span
              key={platform}
              className="text-foreground/55 hover:text-foreground flex items-center gap-2.5 text-lg font-semibold tracking-tight transition"
            >
              <PlatformIcon platform={platform} className="size-5" />
              {PLATFORM_LABELS[platform]}
            </span>
          ))}
        </div>
        <div className="border-border text-muted flex items-center justify-center gap-2 border-t px-6 py-6 text-[13px] font-medium sm:border-t-0 sm:border-l">
          <Radar className="size-4" /> One ranked feed
        </div>
      </Reveal>
    </section>
  );
}
