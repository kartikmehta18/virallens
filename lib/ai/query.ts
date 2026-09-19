import "server-only";
import { getCache } from "../cache";
import { env } from "../env";
import { normalizeTopic } from "../text";
import type { QueryInsight } from "../types";
import { geminiJson } from "./gemini";

// Query understanding for Explore: fixes typos ("devoops" → "devops") and suggests related searches that
// find more posts on the same subject. Gemini's free tier is plenty — each distinct query is asked once and
// cached for 30 days. Without a Gemini key the feature is simply off (no suggestions), nothing breaks.

const EMPTY: QueryInsight = { corrected: null, related: [] };
const TTL = 30 * 24 * 60 * 60;
const RETRY_AFTER_ERROR = 60 * 60;

const SYSTEM =
  "You help people search X, LinkedIn and Instagram for viral posts. Given a search query, return JSON with: " +
  '"corrected" — the query with spelling mistakes fixed (same meaning and language; keep correct words, casing ' +
  'can be lowercase), or exactly the original query if nothing is misspelled; "related" — up to 4 short ' +
  "related search queries (1–3 words each) for closely related subjects, tools or subtopics that would " +
  'surface more posts on the same subject (e.g. for "devops": "kubernetes", "ci cd pipeline", ' +
  '"platform engineering"), most useful first. Stay on the subject — no memes, jokes or generic words unless ' +
  "the query itself is about humor. Never repeat the query itself in related.";

const clean = (value: unknown) => normalizeTopic(String(value ?? "")).slice(0, 60);

const POST_SYSTEM =
  "You turn a social media post into one short search query (2–4 words) that finds other viral posts about the " +
  'same subject on X, LinkedIn and Instagram. Return JSON {"query": "..."}. Describe the subject, not the ' +
  "author; no hashtags, emojis or quotes.";

/**
 * The subject of a post as a search query, for "load more similar posts" once the stored ones run out.
 * Gemini reads the caption (cached per post, 30 days); `fallback` (its key words) is used without a key.
 */
export async function postSearchQuery(post: { id: string; caption: string; tags: string[] }, fallback: string): Promise<string> {
  if (!env.geminiKey) return fallback;
  const cache = await getCache();
  const key = `ai:post-query:v1:${post.id}`;
  const cached = await cache.get(key);
  if (cached) return cached;
  try {
    const result = await geminiJson<{ query?: unknown }>(
      POST_SYSTEM,
      `Post:\n${post.caption.slice(0, 1500)}\nHashtags: ${post.tags.slice(0, 10).join(", ") || "none"}`,
      { type: "OBJECT", properties: { query: { type: "STRING" } }, required: ["query"] },
    );
    const query = clean(result.query).replace(/[#"“”]/g, "");
    if (query.length < 2) return fallback;
    await cache.set(key, query, TTL);
    return query;
  } catch (error) {
    console.error("[virallens] post query failed, using key words:", error);
    return fallback;
  }
}

/** Cached; returns EMPTY when no Gemini key is configured or the call fails. */
export async function understandQuery(query: string): Promise<QueryInsight> {
  const q = normalizeTopic(query);
  if (q.length < 2 || !env.geminiKey) return EMPTY;

  const cache = await getCache();
  const key = `ai:query:v1:${q.toLowerCase()}`;
  const cached = await cache.get(key);
  if (cached) return JSON.parse(cached) as QueryInsight;

  try {
    const result = await geminiJson<{ corrected?: unknown; related?: unknown }>(SYSTEM, `Query: ${q}`, {
      type: "OBJECT",
      properties: { corrected: { type: "STRING" }, related: { type: "ARRAY", items: { type: "STRING" } } },
      required: ["corrected", "related"],
    });
    const corrected = clean(result.corrected);
    const seen = new Set([q.toLowerCase(), corrected.toLowerCase()]);
    const related: string[] = [];
    for (const item of Array.isArray(result.related) ? result.related : []) {
      const text = clean(item);
      if (text.length >= 2 && !seen.has(text.toLowerCase())) {
        seen.add(text.toLowerCase());
        related.push(text);
      }
    }
    const insight: QueryInsight = {
      corrected: corrected && corrected.toLowerCase() !== q.toLowerCase() ? corrected : null,
      related: related.slice(0, 4),
    };
    await cache.set(key, JSON.stringify(insight), TTL);
    return insight;
  } catch (error) {
    console.error("[virallens] query understanding failed:", error);
    await cache.set(key, JSON.stringify(EMPTY), RETRY_AFTER_ERROR);
    return EMPTY;
  }
}
