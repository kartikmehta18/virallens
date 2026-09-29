import { CTA, EMOTION, NUMBERED } from "../ai/heuristic";
import { extractHashtags } from "../text";
import type { MediaType, SignalStatus, SimulationGrade, SimulationSignal } from "../types";

// Structural checks for the virality simulator: the draft's hook, length, layout, hashtags, CTA and format,
// measured the same way on the benchmark's top performers, so every verdict reads "yours vs. theirs".
// Pure functions — no AI, no database.

/** At or above this a draft is "strong" and no rewrites are suggested. */
export const GOOD_SCORE = 70;

export const gradeOf = (score: number): SimulationGrade => (score >= GOOD_SCORE ? "strong" : score >= 40 ? "average" : "weak");

export type HookStyle = "number" | "question" | "curiosity" | "statement";

export const HOOK_LABELS: Record<HookStyle, string> = {
  number: "Number-led",
  question: "Question",
  curiosity: "Curiosity / contrarian",
  statement: "Plain statement",
};

const MEDIA_LABELS: Record<MediaType, string> = { image: "Image", video: "Video", carousel: "Carousel", text: "Text only" };

export interface Features {
  hook: string;
  hookWords: number;
  hookStyle: HookStyle;
  words: number;
  lines: number;
  list: boolean;
  hashtags: number;
  cta: boolean;
  mediaType: MediaType;
}

export const wordCount = (text: string) => text.match(/[\p{L}\p{N}'’]+/gu)?.length ?? 0;

/** The opening a reader sees first: the first line, cut at its first sentence when that line runs long. */
export function hookOf(caption: string): string {
  const line =
    caption
      .split("\n")
      .find((l) => l.trim())
      ?.trim() ?? "";
  if (wordCount(line) <= 20) return line;
  return line.split(/(?<=[.!?])\s+/)[0];
}

/**
 * Where a call to action lives: the last two lines (hashtag-only lines skipped), or the last sentence of a
 * one-line post — so "I wanted to share…" mid-post doesn't count as asking readers to share.
 */
function closingOf(caption: string): string {
  const lines = caption
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !/^(#[\p{L}\p{N}_]+\s*)+$/u.test(l));
  if (lines.length > 1) return lines.slice(-2).join("\n");
  return lines[0]?.split(/(?<=[.!?])\s+/).pop() ?? "";
}

/** A question to the reader, or the shared CTA vocabulary — minus the author's own "I wanted to share…". */
function asksReaders(closing: string): boolean {
  const text = closing.replace(
    /\b(i|we)\s*('d|'ll|\s+would|\s+will|\s+want(ed)?|\s+had|\s+decided|\s+thought i'?d)?\s+(like\s+)?to\s+\w+/gi,
    "",
  );
  return text.includes("?") || CTA.test(text);
}

export function hookStyle(hook: string): HookStyle {
  if (hook.includes("?")) return "question";
  if (/\d/.test(hook)) return "number";
  if (EMOTION.test(hook)) return "curiosity";
  return "statement";
}

export function features(caption: string, mediaType: MediaType): Features {
  const hook = hookOf(caption);
  return {
    hook,
    hookWords: wordCount(hook),
    hookStyle: hookStyle(hook),
    words: wordCount(caption),
    lines: caption.split("\n").filter((l) => l.trim()).length,
    list: NUMBERED.test(caption),
    hashtags: extractHashtags(caption).length,
    cta: asksReaders(closingOf(caption)),
    mediaType,
  };
}

const median = (values: number[]) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return Math.round(sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2);
};
const share = <T>(items: T[], test: (item: T) => boolean) => (items.length ? items.filter(test).length / items.length : 0);
const pct = (fraction: number) => `${Math.round(fraction * 100)}%`;
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** The most common value and its share. */
function mode<T extends string>(values: T[]): { value: T | null; share: number } {
  const counts = new Map<T, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  const [value, count] = [...counts].sort((a, b) => b[1] - a[1])[0] ?? [null, 0];
  return { value, share: values.length ? count / values.length : 0 };
}

const POINTS: Record<SignalStatus, number> = { good: 1, warn: 0.55, bad: 0.15 };
const WEIGHTS: Record<string, number> = {
  hookLength: 1.2,
  hookStyle: 1.2,
  length: 1,
  structure: 0.8,
  hashtags: 0.5,
  cta: 0.7,
  format: 0.8,
};

/**
 * Compares the draft with the benchmark's top performers. `quality` (0–1) is the weighted share of checks
 * the draft passes — the simulator maps it onto the benchmark's bottom…top score range.
 */
export function compareSignals(draft: Features, top: Features[]): { signals: SimulationSignal[]; quality: number } {
  const signals: SimulationSignal[] = [];

  const hookMedian = median(top.map((f) => f.hookWords));
  const hookLimit = Math.max(12, Math.round(hookMedian * 1.5));
  signals.push({
    key: "hookLength",
    label: "Hook length",
    yours: plural(draft.hookWords, "word"),
    top: `${plural(hookMedian, "word")} (median)`,
    status: !draft.hookWords
      ? "bad"
      : draft.hookWords <= hookLimit
        ? "good"
        : draft.hookWords > Math.max(25, hookMedian * 2.5)
          ? "bad"
          : "warn",
    tip:
      draft.hookWords <= hookLimit
        ? "Short enough to land before the “see more” fold."
        : `Top posts open with about ${plural(hookMedian, "word")} — cut your first line down to one sharp idea.`,
  });

  const styles = mode(top.map((f) => f.hookStyle));
  const yourStyleShare = share(top, (f) => f.hookStyle === draft.hookStyle);
  signals.push({
    key: "hookStyle",
    label: "Hook style",
    yours: HOOK_LABELS[draft.hookStyle],
    top: styles.value ? `${pct(styles.share)} ${HOOK_LABELS[styles.value].toLowerCase()}` : "—",
    status: !styles.value || draft.hookStyle === styles.value || yourStyleShare >= 0.25 ? "good" : "warn",
    tip:
      !styles.value || draft.hookStyle === styles.value || yourStyleShare >= 0.25
        ? "Your opener matches a style that works in this niche."
        : `Try a ${HOOK_LABELS[styles.value].toLowerCase()} opener — the most common style among top performers here.`,
  });

  const lengthMedian = median(top.map((f) => f.words));
  const ratio = lengthMedian ? draft.words / lengthMedian : 1;
  signals.push({
    key: "length",
    label: "Length",
    yours: plural(draft.words, "word"),
    top: `${plural(lengthMedian, "word")} (median)`,
    status: ratio >= 0.5 && ratio <= 1.8 ? "good" : ratio >= 0.3 && ratio <= 3 ? "warn" : "bad",
    tip:
      ratio > 1.8
        ? `About ${Math.round(ratio * 10) / 10}× longer than top posts — trim to the essentials.`
        : ratio < 0.5
          ? "Much shorter than top posts — add a concrete example, number or takeaway."
          : "In the same length range as top performers.",
  });

  const skimmable = (f: Features) => f.lines >= 3 || f.list;
  const skimShare = share(top, skimmable);
  const needsLayout = draft.words >= 40 && !skimmable(draft) && skimShare >= 0.5;
  signals.push({
    key: "structure",
    label: "Layout",
    yours: draft.list ? `${plural(draft.lines, "line")}, list` : plural(draft.lines, "line"),
    top: `${pct(skimShare)} use line breaks or lists`,
    status: needsLayout ? "warn" : "good",
    tip: needsLayout ? "Break it into short lines or a list — one idea per line is easier to skim." : "Easy to skim at a glance.",
  });

  const tagMedian = median(top.map((f) => f.hashtags));
  const tooMany = draft.hashtags > tagMedian + 5;
  const missing = draft.hashtags === 0 && tagMedian >= 2;
  signals.push({
    key: "hashtags",
    label: "Hashtags",
    yours: String(draft.hashtags),
    top: `${tagMedian} (median)`,
    status: tooMany || missing ? "warn" : "good",
    tip: tooMany
      ? `Top posts use about ${tagMedian} — drop the weakest tags.`
      : missing
        ? `Top posts use about ${tagMedian} niche hashtags for discovery.`
        : "In line with top performers.",
  });

  const ctaShare = share(top, (f) => f.cta);
  const ctaGap = !draft.cta && ctaShare >= 0.35;
  signals.push({
    key: "cta",
    label: "Call to action",
    yours: draft.cta ? "Yes" : "None",
    top: `${pct(ctaShare)} ask for a reaction`,
    status: ctaGap ? "warn" : "good",
    tip: ctaGap
      ? "End with one clear ask — a question to answer, or a reason to save or share."
      : draft.cta
        ? "Gives readers a clear next step."
        : "Top posts here rarely ask for engagement either.",
  });

  const formats = mode(top.map((f) => f.mediaType));
  const formatShare = share(top, (f) => f.mediaType === draft.mediaType);
  const formatOk = !formats.value || draft.mediaType === formats.value || formatShare >= 0.25;
  signals.push({
    key: "format",
    label: "Format",
    yours: MEDIA_LABELS[draft.mediaType],
    top: formats.value ? `${pct(formats.share)} ${MEDIA_LABELS[formats.value].toLowerCase()}` : "—",
    status: formatOk ? "good" : "warn",
    tip: formatOk
      ? "A format that performs in this niche."
      : `${MEDIA_LABELS[formats.value!]} dominates the top posts here — consider that format.`,
  });

  const totalWeight = signals.reduce((sum, s) => sum + (WEIGHTS[s.key] ?? 1), 0);
  const quality = signals.reduce((sum, s) => sum + POINTS[s.status] * (WEIGHTS[s.key] ?? 1), 0) / totalWeight;
  return { signals, quality };
}

/** Most drafts pass most checks: a draft at this quality lands on the benchmark average. */
const TYPICAL_QUALITY = 0.9;
/** At or below this a draft lands on the bottom-quartile average. */
const FLOOR_QUALITY = 0.5;

/**
 * Structural quality → score on the benchmark's scale: passing every check reaches the top-quartile average,
 * a typical draft the overall average, and one failing the important checks the bottom-quartile average.
 */
export function structuralScore(quality: number, b: { bottomAverage: number; average: number; topAverage: number }): number {
  if (quality >= TYPICAL_QUALITY) {
    return Math.round(b.average + ((quality - TYPICAL_QUALITY) / (1 - TYPICAL_QUALITY)) * (b.topAverage - b.average));
  }
  const drop = Math.min(1, (TYPICAL_QUALITY - quality) / (TYPICAL_QUALITY - FLOOR_QUALITY));
  return Math.round(b.average - drop * (b.average - b.bottomAverage));
}
