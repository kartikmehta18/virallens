import { extractHashtags } from "../text";
import type { Platform, SimulationFix, SimulationGrade, SimulationSignal, SimulationSuggestion } from "../types";
import { HOOK_LABELS, hookOf, hookStyle, wordCount, type HookStyle } from "./signals";

// Built-in feedback for the virality simulator when no AI provider is configured (or none answered):
// verdict, fixes and two rewrites assembled from the structural signals and the benchmark's real top posts.

export interface FallbackInput {
  platform: Platform;
  caption: string;
  niche: string;
  grade: SimulationGrade;
  signals: SimulationSignal[];
  sampleSize: number;
  average: number;
  topAverage: number;
  /** Captions of the benchmark's top performers, best first. */
  topCaptions: string[];
}

const PLATFORM_NAMES: Record<Platform, string> = { x: "X", linkedin: "LinkedIn", instagram: "Instagram" };
const VERDICTS: Record<SimulationGrade, string> = {
  strong: "Built like the top performers",
  average: "Promising, not top-performer ready",
  weak: "Unlikely to break out as written",
};
const CTAS: Record<Platform, string> = {
  x: "Agree?",
  linkedin: "What would you add? Tell me in the comments 👇",
  instagram: "Save this for later and share it with someone who needs it.",
};
const HASHTAG_COUNT: Record<Platform, number> = { x: 1, linkedin: 3, instagram: 5 };

const signal = (signals: SimulationSignal[], key: string) => signals.find((s) => s.key === key);

/** Top performers' openers in a given style — real examples to model a hook on. */
function topHooks(captions: string[], style?: HookStyle): string[] {
  return captions
    .map(hookOf)
    .filter((hook) => wordCount(hook) >= 3 && (!style || hookStyle(hook) === style))
    .map((hook) => (hook.length > 160 ? `${hook.slice(0, 160)}…` : hook));
}

/** Most used hashtags among the top performers (falls back to the niche itself). */
function topTags(captions: string[], niche: string): string[] {
  const counts = new Map<string, number>();
  for (const caption of captions) for (const tag of new Set(extractHashtags(caption))) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  const tags = [...counts].sort((a, b) => b[1] - a[1]).map(([tag]) => tag);
  const own = niche.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
  return own && !tags.includes(own) ? [own, ...tags] : tags;
}

export function fallbackFeedback(input: FallbackInput) {
  const { signals, platform, niche, topCaptions } = input;
  const gaps = signals.filter((s) => s.status !== "good");
  const hookLength = signal(signals, "hookLength");
  const hookStyleSignal = signal(signals, "hookStyle");
  const hook = hookOf(input.caption);
  const hookStatuses = [hookLength?.status, hookStyleSignal?.status];

  const exampleFor = (s: SimulationSignal): string => {
    if (s.key === "hookStyle" || s.key === "hookLength") {
      const best = s.key === "hookLength" ? topHooks(topCaptions).sort((a, b) => a.length - b.length) : topHooks(topCaptions);
      return best[0] ? `Top post: “${best[0]}”` : "";
    }
    if (s.key === "cta") return CTAS[platform];
    if (s.key === "hashtags") {
      return topTags(topCaptions, niche)
        .slice(0, HASHTAG_COUNT[platform])
        .map((t) => `#${t}`)
        .join(" ");
    }
    if (s.key === "structure") return "Line 1: the hook.\nLine 2: the problem.\nLines 3–5: one takeaway each.\nLast line: the ask.";
    return "";
  };

  const fixes: SimulationFix[] = gaps.slice(0, 4).map((s) => ({
    issue: `${s.label}: yours is ${s.yours.toLowerCase()}, top performers ${s.top}`,
    change: s.tip,
    example: exampleFor(s),
  }));

  return {
    verdict: VERDICTS[input.grade],
    summary:
      `Compared with ${input.sampleSize} real ${PLATFORM_NAMES[platform]} posts about “${niche}”: top performers average ` +
      `${input.topAverage}/100 and the whole set ${input.average}/100. ` +
      (gaps.length
        ? `The biggest gaps: ${gaps.map((s) => s.label.toLowerCase()).join(", ")}.`
        : "Structurally it matches what the best posts here do."),
    hook: {
      rating: hookStatuses.includes("bad")
        ? ("weak" as const)
        : hookStatuses.every((s) => s === "good")
          ? ("strong" as const)
          : ("average" as const),
      feedback: `“${hook.length > 120 ? `${hook.slice(0, 120)}…` : hook}” is a ${HOOK_LABELS[hookStyle(hook)].toLowerCase()} opener. ${
        hookLength?.status !== "good" ? hookLength?.tip : (hookStyleSignal?.tip ?? "")
      }`.trim(),
    },
    visual: null,
    strengths: signals
      .filter((s) => s.status === "good")
      .slice(0, 3)
      .map((s) => `${s.label}: ${s.tip}`),
    fixes,
  };
}

/** The draft's own points: sentences and lines without hashtags or list markers. */
function points(caption: string): string[] {
  return caption
    .replace(/#[\p{L}\p{N}_]+/gu, "")
    .split(/\n+|(?<=[.!?])\s+/)
    .map((s) => s.replace(/^\s*(\d+[.)]|[-•→✅])\s*/, "").trim())
    .filter((s) => wordCount(s) >= 3);
}

/** Keeps an X post within 280 characters by dropping body lines from the end. */
function fit(platform: Platform, parts: { head: string; body: string[]; tail: string }): string {
  const build = (body: string[]) => [parts.head, body.join("\n"), parts.tail].filter(Boolean).join("\n\n");
  if (platform !== "x") return build(parts.body);
  const body = [...parts.body];
  while (body.length > 1 && build(body).length > 280) body.pop();
  const text = build(body);
  return text.length > 280 ? `${text.slice(0, 279)}…` : text;
}

/** Two rewrites of the draft: a number-led list and a contrarian opener, both using the draft's own points. */
export function fallbackSuggestions(input: FallbackInput): SimulationSuggestion[] {
  const { platform, niche, topCaptions } = input;
  const all = points(input.caption);
  // With enough material the original opener is replaced by the new hook (and reused as the contrarian
  // version's lead-in, unless it only introduces a list: "5 things that…:").
  const replaceOpener = all.length > 2;
  const lead = replaceOpener && !all[0].endsWith(":") ? all[0] : null;
  const body = (replaceOpener ? all.slice(1) : all).slice(0, 5);
  while (body.length < 3) body.push("[Add one concrete example, number or result]");
  const tags = topTags(topCaptions, niche)
    .slice(0, HASHTAG_COUNT[platform])
    .map((t) => `#${t}`)
    .join(" ");
  const tail = [CTAS[platform], tags].filter(Boolean).join("\n\n");
  const topic = niche.toLowerCase();
  const share = (style: HookStyle) => {
    const hooks = topHooks(topCaptions);
    const n = hooks.filter((h) => hookStyle(h) === style).length;
    return hooks.length && n ? ` — ${Math.round((n / hooks.length) * 100)}% of the top posts here open this way` : "";
  };

  const numberHook = `${body.length} things about ${topic} I wish I knew sooner:`;
  const contrarianHook = `Unpopular opinion: most ${topic} advice gets this backwards.`;
  return [
    {
      hook: numberHook,
      content: fit(platform, { head: numberHook, body: body.map((p, i) => `${i + 1}. ${p}`), tail }),
      why: `A number-led hook promises a specific, skimmable payoff${share("number")}.`,
    },
    {
      hook: contrarianHook,
      content: fit(platform, {
        head: [contrarianHook, lead, "What actually works:"].filter(Boolean).join("\n\n"),
        body: body.map((p) => `→ ${p}`),
        tail,
      }),
      why: `A contrarian opener creates tension the reader wants resolved${share("curiosity")}.`,
    },
  ];
}
