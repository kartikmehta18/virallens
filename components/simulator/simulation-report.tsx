"use client";

import { useQueryClient } from "@tanstack/react-query";
import {
  Check,
  CircleAlert,
  CircleCheck,
  CircleX,
  Copy,
  Gauge,
  Image as ImageIcon,
  Lightbulb,
  Minus,
  Plus,
  ScanSearch,
  Target,
  Trophy,
  TriangleAlert,
  WandSparkles,
  type LucideIcon,
} from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { mediaLayoutId, textGradient } from "@/components/grid/post-card";
import { PlatformLink } from "@/components/icons/platform-link";
import { Crosshairs } from "@/components/ui/primitives";
import { PLATFORM_LABELS } from "@/lib/client/filters";
import { formatCount, mediaSrc } from "@/lib/client/format";
import { setOpenScope } from "@/lib/client/transition";
import type {
  AiBreakdown,
  Post,
  SignalStatus,
  SimulationBenchmark,
  SimulationGrade,
  SimulationResult,
  SimulationSuggestion,
} from "@/lib/types";

const SCOPE = "simulator";

const PROVIDER_LABEL: Record<AiBreakdown["provider"], string> = {
  anthropic: "Claude",
  openai: "OpenAI",
  gemini: "Gemini",
  heuristic: "the built-in analysis",
};

// Status color always comes with an icon and a label.
const GRADES: Record<SimulationGrade, { label: string; icon: LucideIcon; color: string }> = {
  strong: { label: "Strong", icon: CircleCheck, color: "text-good" },
  average: { label: "Needs polish", icon: CircleAlert, color: "text-warn" },
  weak: { label: "Needs work", icon: CircleX, color: "text-bad" },
};
const HOOK_RATINGS: Record<SimulationResult["hook"]["rating"], { label: string; icon: LucideIcon; color: string }> = {
  strong: { label: "Strong", icon: CircleCheck, color: "text-good" },
  average: { label: "Average", icon: CircleAlert, color: "text-warn" },
  weak: { label: "Weak", icon: CircleX, color: "text-bad" },
};
const STATUSES: Record<SignalStatus, { label: string; icon: LucideIcon; color: string }> = {
  good: { label: "On par", icon: CircleCheck, color: "text-good" },
  warn: { label: "Improve", icon: TriangleAlert, color: "text-warn" },
  bad: { label: "Fix", icon: CircleX, color: "text-bad" },
};

function Chip({ label, icon: Icon, color }: { label: string; icon: LucideIcon; color: string }) {
  return (
    <span className="border-border inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-medium">
      <Icon className={`size-3.5 ${color}`} aria-hidden /> {label}
    </span>
  );
}

function SectionTitle({ icon: Icon, title, subtitle }: { icon: LucideIcon; title: string; subtitle?: ReactNode }) {
  return (
    <div className="mb-3">
      <h3 className="flex items-center gap-2 text-base font-semibold">
        <Icon className="text-muted size-4" aria-hidden /> {title}
      </h3>
      {subtitle && <p className="text-muted mt-1 text-[13px] leading-relaxed">{subtitle}</p>}
    </div>
  );
}

export function SimulationReport({ result, onRescore }: { result: SimulationResult; onRescore: (caption: string) => void }) {
  const hookRating = HOOK_RATINGS[result.hook.rating];
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="space-y-8">
      <ScoreCard result={result} />

      <div className={`grid gap-3 ${result.visual ? "sm:grid-cols-2" : ""}`}>
        <div className="border-border rounded-md border p-4">
          <div className="flex items-center gap-2">
            <Target className="text-muted size-4" aria-hidden />
            <h3 className="text-sm font-semibold">Hook</h3>
            <span className="ml-auto">
              <Chip {...hookRating} />
            </span>
          </div>
          <p className="mt-2.5 text-sm leading-relaxed">{result.hook.feedback}</p>
        </div>
        {result.visual && (
          <div className="border-border rounded-md border p-4">
            <div className="flex items-center gap-2">
              <ImageIcon className="text-muted size-4" aria-hidden />
              <h3 className="text-sm font-semibold">Visual</h3>
            </div>
            <p className="mt-2.5 text-sm leading-relaxed">{result.visual}</p>
          </div>
        )}
      </div>

      {result.fixes.length > 0 && (
        <section>
          <SectionTitle icon={WandSparkles} title="What to change" subtitle="Most impactful first, based on what the top performers do." />
          <ol className="space-y-3">
            {result.fixes.map((fix) => (
              <li key={fix.issue} className="border-border rounded-md border p-4">
                <p className="flex gap-2.5 text-sm leading-relaxed">
                  <Minus className="text-bad mt-0.5 size-4 shrink-0" aria-label="Issue" />
                  <span>{fix.issue}</span>
                </p>
                <p className="mt-2 flex gap-2.5 text-sm leading-relaxed">
                  <Plus className="text-good mt-0.5 size-4 shrink-0" aria-label="Change" />
                  <span className="font-medium">{fix.change}</span>
                </p>
                {fix.example && (
                  <p className="border-accent/50 bg-surface-2 mt-3 ml-6.5 border-l-2 px-3 py-2 text-[13.5px] leading-relaxed whitespace-pre-wrap">
                    {fix.example}
                  </p>
                )}
              </li>
            ))}
          </ol>
        </section>
      )}

      {result.strengths.length > 0 && (
        <section>
          <SectionTitle icon={CircleCheck} title="What's working" />
          <ul className="space-y-2">
            {result.strengths.map((strength) => (
              <li key={strength} className="flex gap-2.5 text-sm leading-relaxed">
                <Check className="text-good mt-0.5 size-4 shrink-0" aria-hidden />
                <span>{strength}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {result.suggestions.length > 0 ? (
        <section>
          <SectionTitle
            icon={Lightbulb}
            title="Two stronger versions"
            subtitle="Your draft scored below 70, so here are two rewrites with different hooks, built on what this niche's top performers do. Swap any [placeholders] for your own details."
          />
          <div className="grid gap-4 xl:grid-cols-2">
            {result.suggestions.map((suggestion, i) => (
              <SuggestionCard
                key={suggestion.hook}
                label={`Version ${String.fromCharCode(65 + i)}`}
                suggestion={suggestion}
                onRescore={onRescore}
              />
            ))}
          </div>
        </section>
      ) : (
        <section className="border-border flex items-start gap-3 rounded-md border p-4">
          <CircleCheck className="text-good mt-0.5 size-5 shrink-0" aria-hidden />
          <div>
            <p className="text-sm font-medium">Ready to post</p>
            <p className="text-muted mt-1 text-[13px] leading-relaxed">
              It scores 70 or more — in line with this niche&apos;s top performers, so no rewrite is needed.
              {result.fixes.length > 0 && " The fixes above can still push it further."}
            </p>
          </div>
        </section>
      )}

      <section>
        <SectionTitle
          icon={ScanSearch}
          title="Your post vs. top performers"
          subtitle="Each check is measured the same way on the top quartile of the benchmark."
        />
        <div className="border-border divide-border divide-y rounded-md border">
          <div className="text-muted hidden grid-cols-[130px_minmax(0,1fr)_minmax(0,1.3fr)_96px] gap-x-4 px-4 py-2 text-[11.5px] font-medium sm:grid">
            <span>Check</span>
            <span>Yours</span>
            <span>Top performers</span>
            <span>Status</span>
          </div>
          {result.signals.map((signal) => {
            const status = STATUSES[signal.status];
            return (
              <div
                key={signal.key}
                className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1 px-4 py-3 text-sm sm:grid-cols-[130px_minmax(0,1fr)_minmax(0,1.3fr)_96px] sm:items-center"
              >
                <span className="font-medium">{signal.label}</span>
                <span className="justify-self-end sm:order-last sm:justify-self-start">
                  <span className="flex items-center gap-1.5 text-[12.5px]">
                    <status.icon className={`size-3.5 ${status.color}`} aria-hidden /> {status.label}
                  </span>
                </span>
                <span className="tabular-nums">
                  <span className="text-muted sm:hidden">Yours: </span>
                  {signal.yours}
                </span>
                <span className="text-muted tabular-nums">
                  <span className="sm:hidden">Top: </span>
                  {signal.top}
                </span>
                {signal.status !== "good" && <p className="text-muted col-span-full text-[12.5px] leading-relaxed">{signal.tip}</p>}
              </div>
            );
          })}
        </div>
      </section>

      {result.benchmark.examples.length > 0 && (
        <section>
          <SectionTitle
            icon={Trophy}
            title="Top performers you're benchmarked against"
            subtitle="Real posts from the benchmark, with their score on the same scale. Open one to study it."
          />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {result.benchmark.examples.map(({ post, score }) => (
              <ExampleCard key={post.id} post={post} score={score} />
            ))}
          </div>
        </section>
      )}

      <p className="text-muted text-xs">
        Analysis by {PROVIDER_LABEL[result.provider]}
        {result.provider !== "heuristic" && ", blended with the structural checks"}. Predictions are estimates: timing, audience size and
        the algorithm matter too.
      </p>
    </motion.div>
  );
}

const SCOPE_TEXT: Record<SimulationBenchmark["scope"], (b: SimulationBenchmark) => string> = {
  niche: (b) => `${b.sampleSize} real ${PLATFORM_LABELS[b.platform]} posts about “${b.niche}”`,
  "cross-platform": (b) =>
    `${b.sampleSize} real posts about “${b.niche}” (mixed platforms — few ${PLATFORM_LABELS[b.platform]} posts on it yet)`,
  platform: (b) => `${b.sampleSize} recent ${PLATFORM_LABELS[b.platform]} posts (none on this exact subject yet)`,
};

function ScoreCard({ result }: { result: SimulationResult }) {
  const { benchmark } = result;
  return (
    <section className="border-border bg-surface relative border p-5 sm:p-6">
      <Crosshairs />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-muted text-[13px] font-medium">Predicted virality score</p>
          <p className="mt-1 flex items-baseline gap-1.5">
            <span className="text-[64px] leading-none font-semibold tracking-tight tabular-nums">{result.score}</span>
            <span className="text-muted text-lg">/100</span>
          </p>
        </div>
        <Chip {...GRADES[result.grade]} />
      </div>
      <h2 className="mt-5 text-xl font-semibold tracking-tight">{result.verdict}</h2>
      <p className="text-muted mt-2 text-[15px] leading-relaxed">{result.summary}</p>
      <BenchmarkMeter score={result.score} benchmark={benchmark} />
      <p className="text-muted mt-4 text-xs leading-relaxed">
        Benchmarked against {SCOPE_TEXT[benchmark.scope](benchmark)}. Score = engagement percentile among stored{" "}
        {PLATFORM_LABELS[benchmark.platform]} posts.
      </p>
    </section>
  );
}

/** 0–100 track: the draft's score as the fill, the benchmark's reference averages as ticks (values in the legend). */
function BenchmarkMeter({ score, benchmark }: { score: number; benchmark: SimulationBenchmark }) {
  const marks = [
    { label: "Bottom quartile", value: benchmark.bottomAverage },
    { label: "Niche average", value: benchmark.average },
    { label: "Top quartile", value: benchmark.topAverage },
  ];
  const clampPct = (v: number) => `clamp(18px, ${v}%, calc(100% - 18px))`;
  return (
    <div
      className="mt-6"
      role="img"
      aria-label={`Your draft scores ${score}. ${marks.map((m) => `${m.label} average ${m.value}`).join(", ")}.`}
    >
      <div className="relative pt-6">
        <span
          className="absolute top-0 -translate-x-1/2 text-[11.5px] font-semibold whitespace-nowrap tabular-nums"
          style={{ left: clampPct(score) }}
        >
          You · {score}
        </span>
        <div className="bg-accent/15 relative h-2 rounded-full">
          <motion.div
            className="bg-accent absolute inset-y-0 left-0 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${score}%` }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          />
          {marks.map((m) => (
            <span
              key={m.label}
              title={`${m.label}: ${m.value}`}
              className="absolute -top-1.5 flex h-5 w-3 -translate-x-1/2 justify-center"
              style={{ left: `${m.value}%` }}
            >
              <span className="bg-foreground/70 h-full w-0.5 rounded-full" />
            </span>
          ))}
        </div>
        <div className="text-muted mt-1.5 flex justify-between text-[10.5px] tabular-nums">
          <span>0</span>
          <span>50</span>
          <span>100</span>
        </div>
      </div>
      <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-1.5 text-[12.5px]">
        {marks.map((m) => (
          <div key={m.label} className="flex items-center gap-1.5">
            <span className="bg-foreground/70 h-3 w-0.5 rounded-full" aria-hidden />
            <dt className="text-muted">{m.label}</dt>
            <dd className="font-medium tabular-nums">{m.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function SuggestionCard({
  label,
  suggestion,
  onRescore,
}: {
  label: string;
  suggestion: SimulationSuggestion;
  onRescore: (caption: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(suggestion.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked (insecure context / permissions): the text is still selectable.
    }
  };

  return (
    <article className="border-border bg-surface relative flex flex-col border p-5">
      <Crosshairs />
      <p className="text-muted text-[12px] font-medium">{label}</p>
      <p className="text-muted mt-3 text-[11.5px] font-medium">Hook</p>
      <p className="mt-1 text-[15px] leading-snug font-semibold">{suggestion.hook}</p>
      <p className="text-muted mt-4 text-[11.5px] font-medium">Full post</p>
      <div className="border-border bg-background mt-1 max-h-80 overflow-y-auto rounded-md border p-3 text-[13.5px] leading-relaxed whitespace-pre-wrap">
        {suggestion.content}
      </div>
      {suggestion.why && <p className="text-muted mt-3 text-[12.5px] leading-snug">{suggestion.why}</p>}
      <div className="mt-auto flex gap-2 pt-4">
        <button type="button" onClick={copy} className="btn-secondary h-9 px-3.5 text-[13px]">
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />} {copied ? "Copied" : "Copy"}
        </button>
        <button type="button" onClick={() => onRescore(suggestion.content)} className="btn-primary h-9 flex-1 px-3.5 text-[13px]">
          <Gauge className="size-4" /> Score this version
        </button>
      </div>
    </article>
  );
}

function ExampleCard({ post, score }: { post: Post; score: number }) {
  const queryClient = useQueryClient();
  const image = post.thumbnailUrl ?? (post.mediaType !== "video" && post.mediaType !== "text" ? post.mediaUrls[0] : undefined);
  return (
    <div className="relative">
      <Link
        href={`/post/${post.id}`}
        scroll={false}
        onClick={() => {
          queryClient.setQueryData(["post", post.id], post);
          setOpenScope(SCOPE);
        }}
        className="group focus-visible:ring-accent relative block aspect-[4/5] rounded-[10px] focus-visible:ring-2 focus-visible:outline-none"
        aria-label={`${post.authorName}, score ${score}: ${post.caption.slice(0, 80)}`}
      >
        <motion.div
          layoutId={mediaLayoutId(post.id, SCOPE)}
          style={{ borderRadius: 10 }}
          className="bg-surface-2 relative h-full w-full overflow-hidden"
        >
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={mediaSrc(image)}
              alt=""
              loading="lazy"
              referrerPolicy="no-referrer"
              className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
            />
          ) : (
            <div className={`h-full w-full bg-gradient-to-br p-3 pt-10 ${textGradient(post.id)}`}>
              <p className="line-clamp-6 text-xs leading-snug font-medium text-white">{post.caption}</p>
            </div>
          )}
        </motion.div>
        <span className="absolute top-2 right-2 rounded-full bg-black/75 px-2 py-0.5 text-[11.5px] font-semibold text-white tabular-nums">
          {score}
        </span>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 rounded-b-[10px] bg-gradient-to-t from-black/80 to-transparent p-2.5 pt-8 text-white">
          <p className="truncate text-xs font-medium">{post.authorName}</p>
          <p className="text-[11px] text-white/75">
            ♥ {formatCount(post.likeCount)} · {formatCount(post.commentCount)} comments
          </p>
        </div>
      </Link>
      <PlatformLink post={post} className="absolute top-2 left-2 size-6" iconClassName="size-3" />
    </div>
  );
}
