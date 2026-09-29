import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { env } from "../env";
import type { AiBreakdown, Platform, Post, SimulationBenchmark, SimulationResult, SimulationSignal } from "../types";
import { geminiJson } from "./gemini";

// AI half of the virality simulator: an LLM reads the draft (and its image) next to real top and bottom
// performers from the same niche and predicts a score on their scale, with diff-style fixes and two rewrites.
// Providers are tried in the same order as the breakdown (Claude → OpenAI → Gemini); null when none works.

export interface DraftImage {
  mimeType: "image/jpeg" | "image/png" | "image/webp" | "image/gif";
  /** base64, no data: prefix */
  data: string;
}

export type AiSimulation = Pick<SimulationResult, "verdict" | "summary" | "hook" | "visual" | "strengths" | "fixes" | "suggestions"> & {
  score: number;
};

export interface SimulationContext {
  platform: Platform;
  niche: string;
  scope: SimulationBenchmark["scope"];
  sampleSize: number;
  average: number;
  topAverage: number;
  bottomAverage: number;
  signals: SimulationSignal[];
  top: { post: Post; score: number }[];
  bottom: { post: Post; score: number }[];
  caption: string;
  hasImage: boolean;
}

const PLATFORM_NAMES: Record<Platform, string> = { x: "X (Twitter)", linkedin: "LinkedIn", instagram: "Instagram" };

const SCOPE_TEXT: Record<SimulationBenchmark["scope"], string> = {
  niche: "from the same niche and platform",
  "cross-platform": "from the same niche (mixed platforms — this niche has few posts on the draft's platform)",
  platform: "from the same platform (no posts on this exact subject are stored yet)",
};

export const SIMULATE_SYSTEM =
  "You are a social media growth strategist scoring a DRAFT post before it is published. You get benchmark data: real " +
  "posts from the draft's niche, each with a 0-100 virality score (its engagement percentile among all stored posts on " +
  "its platform), split into top and bottom performers, plus a structural comparison of the draft against the top ones. " +
  "Predict the draft's score on the same 0-100 scale by comparing it with those real posts: hook, format, structure, " +
  "specificity, emotional pull, call to action and, if an image is attached, the visual. Be calibrated: an ordinary draft " +
  "lands near the benchmark average; only a draft that matches the top performers' patterns AND has a genuinely strong " +
  "hook deserves a top-quartile score. Feedback must be specific to this draft and cite patterns from the benchmark posts " +
  '(e.g. "3 of the 5 top posts open with a number"), never generic advice. Fixes are diff-style: the issue, the change, ' +
  "and a concrete rewritten line. Always write exactly 2 complete alternative versions of the post, each with a different " +
  "hook style, keeping the author's message and facts: never invent statistics, results or anecdotes — use a [placeholder] " +
  "where a specific detail is needed. Match the platform: X at most 280 characters; LinkedIn short lines with white space; " +
  "Instagram a strong first line and a few relevant hashtags. Plain text only, no markdown. Never state the numeric score " +
  "in the text fields.";

const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max)}…` : text);

function example({ post, score }: { post: Post; score: number }, i: number): string {
  const stats = `${post.likeCount} likes, ${post.commentCount} comments, ${post.shareCount} shares${post.viewCount ? `, ${post.viewCount} views` : ""}`;
  return `[${i + 1}] score ${score}/100 · ${PLATFORM_NAMES[post.platform]} · ${post.mediaType} · ${stats}\n${clip(post.caption.trim(), 600) || "(no caption)"}`;
}

export function simulationPrompt(c: SimulationContext): string {
  return [
    `Platform: ${PLATFORM_NAMES[c.platform]}`,
    `Niche: ${c.niche}`,
    `Benchmark: ${c.sampleSize} real posts ${SCOPE_TEXT[c.scope]}.`,
    `Scale: top quartile averages ${c.topAverage}/100, the whole benchmark ${c.average}/100, the bottom quartile ${c.bottomAverage}/100.`,
    "",
    "Structural comparison (draft vs. top performers):",
    ...c.signals.map((s) => `- ${s.label}: draft ${s.yours}; top performers ${s.top}`),
    "",
    "TOP PERFORMERS:",
    ...c.top.map(example),
    "",
    "BOTTOM PERFORMERS:",
    ...c.bottom.map(example),
    "",
    `DRAFT (${c.hasImage ? "its image is attached" : "text only, no image"}):`,
    c.caption,
  ].join("\n");
}

const SimulationSchema = z.object({
  score: z.number().describe("Predicted virality score for the draft, 0-100, on the benchmark's scale"),
  verdict: z.string().describe("A 3-8 word headline verdict"),
  summary: z
    .string()
    .describe("2-3 sentences: how the draft compares with the top performers and the main reason for any gap. No numeric score."),
  hook: z.object({
    rating: z.enum(["weak", "average", "strong"]),
    feedback: z.string().describe("1-2 sentences on the opening line, compared with the top performers' openers"),
  }),
  visual: z
    .string()
    .describe(
      "1-2 sentences on the attached image: scroll-stopping power, text overlay, fit with the caption. Empty string when no image.",
    ),
  strengths: z.array(z.string()).describe("0-3 things the draft already does well"),
  fixes: z
    .array(
      z.object({
        issue: z.string().describe("What is holding the draft back"),
        change: z.string().describe("What to change, referencing what top performers do"),
        example: z.string().describe("A concrete rewritten line for this draft"),
      }),
    )
    .describe("2-4 diff-style fixes, most impactful first"),
  suggestions: z
    .array(
      z.object({
        hook: z.string().describe("The opening line"),
        content: z.string().describe("The complete post, starting with the hook, ready to publish"),
        why: z.string().describe("One sentence: which top-performer pattern this version uses"),
      }),
    )
    .describe("Exactly 2 alternative versions of the post with different hook styles"),
});

/** Field guide for the providers that only get a bare JSON shape (Claude reads the schema's descriptions). */
const FIELD_GUIDE =
  "Fields: score = predicted 0-100 score; verdict = a 3-8 word headline, not a sentence; summary = 2-3 sentences on how " +
  "the draft compares with the top performers; hook.rating = weak, average or strong, hook.feedback = 1-2 sentences on the " +
  "opening line; visual = 1-2 sentences on the image, empty string when there is none; strengths = 0-3 short items; " +
  "fixes = 2-4 items (issue, change, example = a concrete rewritten line); suggestions = exactly 2 complete posts (hook = " +
  "the opening line, content = the full post starting with that hook, why = one sentence on the pattern it uses).";

const JSON_SHAPE =
  '{"score": number, "verdict": string, "summary": string, "hook": {"rating": "weak"|"average"|"strong", "feedback": string}, ' +
  '"visual": string, "strengths": string[], "fixes": [{"issue": string, "change": string, "example": string}], ' +
  '"suggestions": [{"hook": string, "content": string, "why": string}]}';

async function anthropicSimulate(prompt: string, image: DraftImage | null): Promise<unknown> {
  const client = new Anthropic({ apiKey: env.anthropicKey ?? undefined });
  const response = await client.messages.parse({
    model: "claude-opus-5",
    max_tokens: 16000,
    output_config: { effort: "low", format: zodOutputFormat(SimulationSchema) },
    system: SIMULATE_SYSTEM,
    messages: [
      {
        role: "user",
        content: [
          ...(image ? [{ type: "image" as const, source: { type: "base64" as const, media_type: image.mimeType, data: image.data } }] : []),
          { type: "text" as const, text: prompt },
        ],
      },
    ],
  });
  return response.stop_reason === "refusal" ? null : response.parsed_output;
}

async function openaiSimulate(prompt: string, image: DraftImage | null): Promise<unknown> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.openaiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: `${SIMULATE_SYSTEM} ${FIELD_GUIDE} Respond as JSON: ${JSON_SHAPE}` },
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            ...(image ? [{ type: "image_url", image_url: { url: `data:${image.mimeType};base64,${image.data}` } }] : []),
          ],
        },
      ],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  return JSON.parse(data.choices?.[0]?.message?.content ?? "null");
}

const STRING = { type: "STRING" };
const GEMINI_SCHEMA = {
  type: "OBJECT",
  properties: {
    score: { type: "NUMBER" },
    verdict: STRING,
    summary: STRING,
    hook: { type: "OBJECT", properties: { rating: STRING, feedback: STRING }, required: ["rating", "feedback"] },
    visual: STRING,
    strengths: { type: "ARRAY", items: STRING },
    fixes: {
      type: "ARRAY",
      items: { type: "OBJECT", properties: { issue: STRING, change: STRING, example: STRING }, required: ["issue", "change", "example"] },
    },
    suggestions: {
      type: "ARRAY",
      items: { type: "OBJECT", properties: { hook: STRING, content: STRING, why: STRING }, required: ["hook", "content", "why"] },
    },
  },
  required: ["score", "verdict", "summary", "hook", "visual", "strengths", "fixes", "suggestions"],
};

const geminiSimulate = (prompt: string, image: DraftImage | null) =>
  geminiJson<unknown>(`${SIMULATE_SYSTEM} ${FIELD_GUIDE}`, prompt, GEMINI_SCHEMA, image);

type LlmProvider = Exclude<AiBreakdown["provider"], "heuristic">;

const PROVIDERS: { name: LlmProvider; enabled: () => boolean; run: (prompt: string, image: DraftImage | null) => Promise<unknown> }[] = [
  { name: "anthropic", enabled: () => Boolean(env.anthropicKey), run: anthropicSimulate },
  { name: "openai", enabled: () => Boolean(env.openaiKey), run: openaiSimulate },
  { name: "gemini", enabled: () => Boolean(env.geminiKey), run: geminiSimulate },
];

const text = (value: unknown, max: number) => (typeof value === "string" ? value.trim().slice(0, max) : "");

/** A short headline; a model that wrote a paragraph gets its first sentence, or nothing (the built-in verdict is used). */
function headline(value: unknown): string {
  const full = text(value, 400);
  const first = full.length > 80 ? full.split(/(?<=[.!?:])\s/)[0] : full;
  return first.length > 80 ? "" : first.replace(/[.:]$/, "");
}
const list = (value: unknown): Record<string, unknown>[] =>
  Array.isArray(value) ? value.filter((v): v is Record<string, unknown> => Boolean(v) && typeof v === "object") : [];

/** Validates and trims whatever a provider returned; null when it isn't usable. */
function normalize(raw: unknown): AiSimulation | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const score = Number(r.score);
  if (!Number.isFinite(score)) return null;
  const hook = (r.hook && typeof r.hook === "object" ? r.hook : {}) as Record<string, unknown>;
  const rating = hook.rating === "weak" || hook.rating === "strong" ? hook.rating : "average";
  return {
    score: Math.min(100, Math.max(0, Math.round(score))),
    verdict: headline(r.verdict),
    summary: text(r.summary, 900),
    hook: { rating, feedback: text(hook.feedback, 600) },
    visual: text(r.visual, 600) || null,
    strengths: (Array.isArray(r.strengths) ? r.strengths : [])
      .map((s) => text(s, 300))
      .filter(Boolean)
      .slice(0, 3),
    fixes: list(r.fixes)
      .map((f) => ({ issue: text(f.issue, 300), change: text(f.change, 500), example: text(f.example, 600) }))
      .filter((f) => f.issue && f.change)
      .slice(0, 4),
    suggestions: list(r.suggestions)
      .map((s) => ({ hook: text(s.hook, 300), content: text(s.content, 4000), why: text(s.why, 300) }))
      .filter((s) => s.hook && s.content)
      .slice(0, 2),
  };
}

/** Past this the simulator answers with the built-in analysis instead (the route's limit is 60s). */
const AI_TIMEOUT_MS = 45_000;

/**
 * Runs the first configured provider that returns a usable answer; null when none is set, all fail, or they
 * run past AI_TIMEOUT_MS (a late answer is ignored).
 */
export async function aiSimulate(
  context: SimulationContext,
  image: DraftImage | null,
): Promise<{ result: AiSimulation; provider: LlmProvider } | null> {
  const prompt = simulationPrompt(context);
  const run = async () => {
    for (const provider of PROVIDERS.filter((p) => p.enabled())) {
      try {
        const result = normalize(await provider.run(prompt, image));
        if (result) return { result, provider: provider.name };
      } catch (error) {
        console.error(`[virallens] ${provider.name} simulation failed, trying the next provider:`, error);
      }
    }
    return null;
  };
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => {
      console.error("[virallens] AI simulation timed out, using the built-in analysis");
      resolve(null);
    }, AI_TIMEOUT_MS);
  });
  return Promise.race([run(), timeout]).finally(() => clearTimeout(timer));
}
