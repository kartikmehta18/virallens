import "server-only";
import { env } from "../env";
import type { Post } from "../types";
import { BREAKDOWN_SYSTEM, breakdownPrompt } from "./prompt";

// "-latest" aliases track Google's current models, so they don't break when a version is retired.
// Free-tier models are often briefly overloaded (503/429), so we fall through to lighter models.
const DEFAULT_MODELS = ["gemini-flash-latest", "gemini-flash-lite-latest"];
const RETRYABLE = new Set([404, 429, 500, 503]);

/** Google Gemini provider (free tier key from Google AI Studio). Uses JSON mode with a response schema. */
export async function geminiBreakdown(post: Post): Promise<string[] | null> {
  const preferred = process.env.GEMINI_MODEL?.trim();
  const models = [...new Set([...(preferred ? [preferred] : []), ...DEFAULT_MODELS])];
  let lastError: Error | null = null;

  for (const model of models) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "x-goog-api-key": env.geminiKey ?? "", "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: BREAKDOWN_SYSTEM }] },
        contents: [{ role: "user", parts: [{ text: breakdownPrompt(post) }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: { bullets: { type: "ARRAY", items: { type: "STRING" } } },
            required: ["bullets"],
          },
        },
      }),
    });
    if (!res.ok) {
      lastError = new Error(`Gemini ${model} ${res.status}: ${(await res.text()).slice(0, 200)}`);
      if (RETRYABLE.has(res.status)) continue;
      throw lastError;
    }
    const data = await res.json();
    const text: string = data.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text ?? "").join("") ?? "";
    const parsed = JSON.parse(text || "{}");
    const bullets: string[] = Array.isArray(parsed.bullets) ? parsed.bullets.map((b: unknown) => String(b).trim()).filter(Boolean) : [];
    return bullets.length ? bullets.slice(0, 5) : null;
  }
  throw lastError ?? new Error("Gemini: no model available");
}
