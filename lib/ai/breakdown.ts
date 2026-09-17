import "server-only";
import { env } from "../env";
import type { AiBreakdown, Post } from "../types";
import { anthropicBreakdown } from "./anthropic";
import { geminiBreakdown } from "./gemini";
import { heuristicBreakdown } from "./heuristic";
import { openaiBreakdown } from "./openai";

export { BREAKDOWN_SYSTEM, breakdownPrompt } from "./prompt";

type LlmProvider = Exclude<AiBreakdown["provider"], "heuristic">;

const PROVIDERS: { name: LlmProvider; enabled: () => boolean; run: (post: Post) => Promise<string[] | null> }[] = [
  { name: "anthropic", enabled: () => Boolean(env.anthropicKey), run: anthropicBreakdown },
  { name: "openai", enabled: () => Boolean(env.openaiKey), run: openaiBreakdown },
  { name: "gemini", enabled: () => Boolean(env.geminiKey), run: geminiBreakdown },
];

/** Every provider with a key configured, in preference order: Claude → OpenAI → Gemini. */
export const configuredAiProviders = (): LlmProvider[] => PROVIDERS.filter((p) => p.enabled()).map((p) => p.name);

export function activeAiProvider(): AiBreakdown["provider"] {
  return configuredAiProviders()[0] ?? "heuristic";
}

/**
 * Generates a "why this went viral" breakdown. Tries each configured provider in order, so any single
 * working key is enough; if all of them fail (or none is set) it falls back to the heuristic analysis.
 */
export async function generateBreakdown(post: Post): Promise<AiBreakdown> {
  for (const provider of PROVIDERS.filter((p) => p.enabled())) {
    try {
      const bullets = await provider.run(post);
      if (bullets) return { bullets, provider: provider.name, generatedAt: new Date().toISOString() };
    } catch (error) {
      console.error(`[virallens] ${provider.name} breakdown failed, trying the next provider:`, error);
    }
  }
  return { bullets: heuristicBreakdown(post), provider: "heuristic", generatedAt: new Date().toISOString() };
}
