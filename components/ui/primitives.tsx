"use client";

import { motion, type HTMLMotionProps } from "motion/react";
import Image from "next/image";
import type { ReactNode } from "react";
import logo from "@/public/logo.webp";

/** A single blue "+" marker; position it with className (e.g. "-left-[5px] -top-[5px]"). */
export function CrossMark({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 9 9"
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
      className={`text-accent pointer-events-none absolute z-10 size-[9px] ${className}`}
    >
      <path d="M4.5 0v9M0 4.5h9" />
    </svg>
  );
}

/** Blue "+" markers pinned to the four corners of a relatively-positioned bordered frame. */
export function Crosshairs() {
  return (
    <>
      <CrossMark className="-top-[5px] -left-[5px]" />
      <CrossMark className="-top-[5px] -right-[5px]" />
      <CrossMark className="-bottom-[5px] -left-[5px]" />
      <CrossMark className="-right-[5px] -bottom-[5px]" />
    </>
  );
}

/** Card with a cut top-right corner and a 1px border that follows the cut. */
export function ChamferCard({
  children,
  className = "",
  innerClassName = "",
  cut = 36,
  highlight = false,
}: {
  children: ReactNode;
  className?: string;
  innerClassName?: string;
  cut?: number;
  highlight?: boolean;
}) {
  const clip = (c: number) => `polygon(0 0, calc(100% - ${c}px) 0, 100% ${c}px, 100% 100%, 0 100%)`;
  return (
    <div className={`p-px ${highlight ? "bg-accent" : "bg-border"} ${className}`} style={{ clipPath: clip(cut) }}>
      <div className={`bg-surface h-full ${innerClassName}`} style={{ clipPath: clip(cut - 0.4) }}>
        {children}
      </div>
    </div>
  );
}

/** Fade-up on scroll into view. */
export function Reveal({ children, delay = 0, y = 18, ...rest }: HTMLMotionProps<"div"> & { delay?: number; y?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

/** Small uppercase-free eyebrow label above section headings. */
export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="text-muted mb-4 text-sm font-medium">{children}</p>;
}

/** Brand mark. */
export function LogoMark({ className = "size-7" }: { className?: string }) {
  return <Image src={logo} alt="ViralLens" priority className={`shrink-0 rounded-[5px] object-cover ${className}`} sizes="48px" />;
}
