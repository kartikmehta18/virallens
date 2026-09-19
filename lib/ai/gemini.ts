import "server-only";
import { env } from "../env";
import type { Post } from "../types";
import { BREAKDOWN_SYSTEM, breakdownPrompt } from "./prompt";

// "-latest" aliases track Google's current models, so they don't break when a version is retired.
// Free-tier models are often briefly overloaded (503/429), so we fall through to lighter models.
const DEFAULT_MODELS = ["gemini-flash-latest", "gemini-flash-lite-latest"];
const RETRYABLE = new Set([404, 429, 500, 503]);

/**
 * One Gemini call in JSON mode (free tier key from Google AI Studio): tries each model in turn on
 * retryable errors and returns the parsed JSON object.
 */
export async function geminiJson<T>(system: string, prompt: string, responseSchema: Record<string, unknown>): Promise<T> {
  const preferred = process.env.GEMINI_MODEL?.trim();
  const models = [...new Set([...(preferred ? [preferred] : []), ...DEFAULT_MODELS])];
  let lastError: Error | null = null;

  for (const model of models) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "x-goog-api-key": env.geminiKey ?? "", "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json", responseSchema },
      }),
    });
    if (!res.ok) {
      lastError = new Error(`Gemini ${model} ${res.status}: ${(await res.text()).slice(0, 200)}`);
      if (RETRYABLE.has(res.status)) continue;
      throw lastError;
    }
    const data = await res.json();
    const text: string = data.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text ?? "").join("") ?? "";
    return JSON.parse(text || "{}") as T;
  }
  throw lastError ?? new Error("Gemini: no model available");
}

/** Google Gemini provider for the "why this went viral" breakdown. */
export async function geminiBreakdown(post: Post): Promise<string[] | null> {
  const parsed = await geminiJson<{ bullets?: unknown }>(BREAKDOWN_SYSTEM, breakdownPrompt(post), {
    type: "OBJECT",
    properties: { bullets: { type: "ARRAY", items: { type: "STRING" } } },
    required: ["bullets"],
  });
  const bullets: string[] = Array.isArray(parsed.bullets) ? parsed.bullets.map((b: unknown) => String(b).trim()).filter(Boolean) : [];
  return bullets.length ? bullets.slice(0, 5) : null;
}
