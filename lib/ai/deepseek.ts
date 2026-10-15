import "server-only";
import { env } from "../env";
import type { Post } from "../types";
import { BREAKDOWN_SYSTEM, breakdownPrompt } from "./prompt";

/**
 * One DeepSeek call in JSON mode (OpenAI-compatible API, key from platform.deepseek.com). DeepSeek only
 * follows a JSON shape given in words, so `shape` describes the object to return; the API also requires the
 * word "json" in the prompt, which `shape` provides. Text only — DeepSeek's chat models can't read images.
 */
export async function deepseekJson<T>(system: string, prompt: string, shape: string): Promise<T> {
  const res = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.deepseekKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.DEEPSEEK_MODEL?.trim() || "deepseek-chat",
      response_format: { type: "json_object" },
      max_tokens: 4000,
      messages: [
        { role: "system", content: `${system} Respond only with a JSON object of this shape: ${shape}` },
        { role: "user", content: prompt },
      ],
    }),
  });
  if (!res.ok) throw new Error(`DeepSeek ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  // JSON mode can occasionally return empty content; treat it as an empty answer.
  return JSON.parse(data.choices?.[0]?.message?.content || "{}") as T;
}

/** DeepSeek provider for the "why this went viral" breakdown. */
export async function deepseekBreakdown(post: Post): Promise<string[] | null> {
  const parsed = await deepseekJson<{ bullets?: unknown }>(BREAKDOWN_SYSTEM, breakdownPrompt(post), '{"bullets": string[]}');
  const bullets = Array.isArray(parsed.bullets) ? parsed.bullets.map((b: unknown) => String(b).trim()).filter(Boolean) : [];
  return bullets.length ? bullets.slice(0, 5) : null;
}
