"use client";

import Link from "next/link";
import { AsciiField } from "@/components/ui/ascii-field";
import { CrossMark, Reveal } from "@/components/ui/primitives";

export function FinalCta() {
  return (
    <section className="relative overflow-hidden">
      <div className="relative mx-auto max-w-[1440px] px-5 sm:px-8 lg:px-10">
        <div className="bg-border relative h-px">
          <CrossMark className="-top-[4px] -left-[5px]" />
          <CrossMark className="-top-[4px] left-1/2 -translate-x-1/2" />
          <CrossMark className="-top-[4px] -right-[5px]" />
        </div>
      </div>

      <div aria-hidden className="absolute inset-x-0 top-24 bottom-0">
        <AsciiField variant="cta" cell={10} />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_38%_42%_at_50%_50%,var(--background)_0%,color-mix(in_oklab,var(--background)_70%,transparent)_50%,transparent_78%)]" />
      </div>

      <Reveal className="relative mx-auto max-w-3xl px-5 py-40 text-center sm:py-48">
        <h2 className="display text-[40px] sm:text-[56px]">
          Stop guessing what
          <br />
          <b>goes viral</b>
        </h2>
        <p className="text-muted mx-auto mt-5 max-w-md text-base leading-relaxed">
          Search a topic, study the winners and save what works — your next best post is already out there.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Link href="/explore" className="btn-primary">
            Get started
          </Link>
          <Link href="/explore?topic=AI%20tools" className="btn-secondary">
            Try a live search
          </Link>
        </div>
      </Reveal>
    </section>
  );
}
