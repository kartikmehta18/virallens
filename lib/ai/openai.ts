import "server-only";
import { env } from "../env";
import type { Post } from "../types";
import { BREAKDOWN_SYSTEM, breakdownPrompt } from "./prompt";

/** OpenAI provider (used only when OPENAI_API_KEY is set and no Anthropic key is configured). */
export async function openaiBreakdown(post: Post): Promise<string[] | null> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.openaiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: `${BREAKDOWN_SYSTEM} Respond as JSON: {"bullets": string[]}` },
        { role: "user", content: breakdownPrompt(post) },
      ],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const parsed = JSON.parse(data.choices?.[0]?.message?.content ?? "{}");
  const bullets = Array.isArray(parsed.bullets) ? parsed.bullets.map(String).filter(Boolean) : [];
  return bullets.length ? bullets.slice(0, 5) : null;
}
