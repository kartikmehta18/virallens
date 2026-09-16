"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { AsciiField } from "@/components/ui/ascii-field";
import { useSession } from "@/lib/client/session";
import { ProductWindow } from "./product-window";

const ease = [0.22, 1, 0.36, 1] as const;

export function Hero() {
  const { user } = useSession();

  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_-5%,color-mix(in_oklab,var(--foreground)_6%,transparent),transparent_70%)]"
      />
      <div aria-hidden className="absolute inset-x-0 top-0 h-[1100px]">
        <AsciiField variant="hero" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_48%_40%_at_50%_32%,var(--background)_0%,color-mix(in_oklab,var(--background)_78%,transparent)_45%,transparent_72%)]" />
      </div>

      <div className="relative mx-auto max-w-[1440px] px-5 pt-20 text-center sm:px-8 sm:pt-28 lg:px-10">
        <motion.h1
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease }}
          className="display mx-auto max-w-4xl text-[40px] sm:text-[56px]"
        >
          See what&apos;s going viral
          <br />
          <b>before everyone else</b>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease, delay: 0.12 }}
          className="text-muted mx-auto mt-5 max-w-xl text-[15px] leading-relaxed sm:text-base"
        >
          ViralLens pulls the top-performing posts from X, LinkedIn and Instagram into one ranked feed — so you can study what works and
          ship content that lands.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease, delay: 0.22 }}
          className="mt-8 flex items-center justify-center gap-3"
        >
          <Link href="/explore" className="btn-primary">
            Get Started
          </Link>
          <Link href={user ? "/boards" : "/login"} className="btn-secondary">
            {user ? "Your Boards" : "Sign In"}
          </Link>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.1, ease, delay: 0.35 }}
          className="relative mx-auto mt-16 max-w-[1100px] pb-24 text-left"
        >
          <ProductWindow />
        </motion.div>
      </div>
    </section>
  );
}
