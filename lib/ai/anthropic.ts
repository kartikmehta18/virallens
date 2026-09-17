import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { env } from "../env";
import type { Post } from "../types";
import { BREAKDOWN_SYSTEM, breakdownPrompt } from "./prompt";

const BreakdownSchema = z.object({
  bullets: z.array(z.string()).describe("3-5 bullet points explaining why the post performed well"),
});

/** Returns bullets, or null when Claude declines (the caller then falls back to heuristics). */
export async function anthropicBreakdown(post: Post): Promise<string[] | null> {
  const client = new Anthropic({ apiKey: env.anthropicKey ?? undefined });
  const response = await client.messages.parse({
    model: "claude-opus-5",
    max_tokens: 16000,
    output_config: { effort: "low", format: zodOutputFormat(BreakdownSchema) },
    system: BREAKDOWN_SYSTEM,
    messages: [{ role: "user", content: breakdownPrompt(post) }],
  });

  if (response.stop_reason === "refusal" || !response.parsed_output) return null;
  const bullets = response.parsed_output.bullets.map((b) => b.trim()).filter(Boolean);
  return bullets.length ? bullets.slice(0, 5) : null;
}
