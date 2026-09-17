"use client";

import { animate, useInView } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { PlatformIcon } from "@/components/icons/platform-icon";
import { CrossMark, Crosshairs, Reveal } from "@/components/ui/primitives";
import { useTrendingPosts } from "./use-landing-data";

function CountUp({ to, suffix = "" }: { to: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!inView) return;
    const controls = animate(0, to, { duration: 1.4, ease: [0.22, 1, 0.36, 1], onUpdate: (v) => setValue(Math.round(v)) });
    return () => controls.stop();
  }, [inView, to]);
  return (
    <span ref={ref} className="tabular-nums">
      {value.toLocaleString()}
      {suffix}
    </span>
  );
}

export function Outcomes() {
  const { data } = useTrendingPosts(1);
  const rows = [
    {
      value: data?.total ?? 0,
      suffix: "",
      label: "Posts analyzed in this workspace",
      mark: <PlatformIcon platform="instagram" className="size-6" />,
    },
    { value: 3, suffix: "", label: "Platforms in one ranked feed", mark: <PlatformIcon platform="linkedin" className="size-6" /> },
    { value: 1, suffix: "", label: "Virality score to compare them all", mark: <PlatformIcon platform="x" className="size-6" /> },
  ];

  return (
    <section className="mx-auto grid max-w-[1440px] gap-12 px-5 pb-24 sm:px-8 sm:pb-32 lg:grid-cols-2 lg:px-10">
      <Reveal>
        <h2 className="display text-[34px] sm:text-[44px]">
          Research that turns
          <br />
          into <b>reach</b>
        </h2>
        <p className="text-muted mt-5 max-w-md text-base leading-relaxed">
          From the first search to a saved swipe file, every number in ViralLens comes from real posts — scored on the same scale and
          refreshed as the feed moves.
        </p>
      </Reveal>

      <Reveal delay={0.1} className="border-border relative border">
        <Crosshairs />
        {rows.map((row, i) => (
          <div
            key={row.label}
            className={`relative flex items-center justify-between gap-6 px-8 py-8 ${i > 0 ? "border-border border-t" : ""}`}
          >
            {i > 0 && (
              <>
                <CrossMark className="-top-[5px] -left-[5px]" />
                <CrossMark className="-top-[5px] -right-[5px]" />
              </>
            )}
            <div>
              <p className="text-[56px] leading-none font-light tracking-tight">
                <CountUp to={row.value} suffix={row.suffix} />
              </p>
              <p className="text-muted mt-3 text-sm">{row.label}</p>
            </div>
            <span className="text-foreground/45">{row.mark}</span>
          </div>
        ))}
      </Reveal>
    </section>
  );
}
