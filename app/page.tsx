import type { Metadata } from "next";
import { Audiences } from "@/components/landing/audiences";
import { Challenge } from "@/components/landing/challenge";
import { Features } from "@/components/landing/features";
import { FinalCta } from "@/components/landing/final-cta";
import { Hero } from "@/components/landing/hero";
import { Outcomes } from "@/components/landing/outcomes";
import { PlatformStrip } from "@/components/landing/platform-strip";
import { SiteFooter } from "@/components/landing/site-footer";
import { VisibilityScroll } from "@/components/landing/visibility-scroll";
import { Workflow } from "@/components/landing/workflow";

export const metadata: Metadata = {
  title: "ViralLens — see what's going viral before everyone else",
};

export default function LandingPage() {
  return (
    <>
      <Hero />
      <PlatformStrip />
      <VisibilityScroll />
      <div className="pt-24 sm:pt-32">
        <Features />
        <Challenge />
        <Workflow />
        <Outcomes />
        <Audiences />
      </div>
      <FinalCta />
      <SiteFooter />
    </>
  );
}
