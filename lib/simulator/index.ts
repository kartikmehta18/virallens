import "server-only";
import { aiSimulate, type DraftImage } from "../ai/simulate";
import { ApiError } from "../http";
import { parseSearch } from "../search";
import { keyTerms } from "../similar";
import { extractHashtags } from "../text";
import type { MediaType, Platform, Post, SimulationResult } from "../types";
import { findBenchmark } from "./benchmark";
import { fallbackFeedback, fallbackSuggestions } from "./fallback";
import { compareSignals, features, gradeOf, structuralScore } from "./signals";

// Virality simulator: scores a draft before it's published, against real stored posts in its niche.
//   1. benchmark   the draft's niche (topic search + similar posts), each post scored 0–100 on its platform
//   2. structure   hook, length, layout, hashtags, CTA and format vs. the benchmark's top quartile
//   3. judgment    an LLM compares the draft (and its image) with the top and bottom posts
// The final score blends the LLM's prediction with the structural estimate, so it stays anchored to data.
// Below GOOD_SCORE the result carries two rewrites (hook + content).

export type { DraftImage };

/** Share of the final score that comes from the LLM; the rest is the structural estimate. */
const AI_WEIGHT = 0.7;
const EXAMPLES = 4;

export interface SimulateInput {
  platform: Platform;
  caption: string;
  niche: string | null;
  image: DraftImage | null;
}

export async function simulatePost({ platform, caption, niche, image }: SimulateInput): Promise<SimulationResult> {
  const now = new Date().toISOString();
  const mediaType: MediaType = image ? "image" : "text";
  // A stand-in Post so the similar-posts engine can rank real posts against the draft. The niche's words
  // act as extra tags, which that engine weighs first.
  const draft: Post = {
    id: "draft",
    platform,
    authorName: "You",
    authorHandle: "you",
    authorAvatarUrl: null,
    caption,
    mediaType,
    mediaUrls: [],
    thumbnailUrl: null,
    postUrl: "",
    likeCount: 0,
    commentCount: 0,
    shareCount: 0,
    viewCount: null,
    engagementScore: 0,
    trendingScore: 0,
    memeScore: 0,
    topic: niche ?? "",
    tags: [...new Set([...(niche ? parseSearch(niche).words : []), ...extractHashtags(caption)])],
    aiBreakdown: null,
    publishedAt: now,
    fetchedAt: now,
  };

  const bench = await findBenchmark(draft, niche);
  if (!bench.posts.length) {
    throw new ApiError(409, "There are no stored posts to benchmark against yet — search a topic in Explore first, then try again.");
  }
  const nicheLabel = niche || keyTerms(draft).slice(0, 3).join(" ") || "general";

  const { signals, quality } = compareSignals(
    features(caption, mediaType),
    bench.top.map(({ post }) => features(post.caption, post.mediaType)),
  );
  const structural = structuralScore(quality, bench);

  const ai = await aiSimulate(
    {
      platform,
      niche: nicheLabel,
      scope: bench.scope,
      sampleSize: bench.posts.length,
      average: bench.average,
      topAverage: bench.topAverage,
      bottomAverage: bench.bottomAverage,
      signals,
      top: bench.top.slice(0, 5),
      bottom: bench.bottom.slice(-3),
      caption,
      hasImage: Boolean(image),
    },
    image,
  );

  const score = Math.min(99, Math.max(1, ai ? Math.round(ai.result.score * AI_WEIGHT + structural * (1 - AI_WEIGHT)) : structural));
  const grade = gradeOf(score);
  const fallbackInput = {
    platform,
    caption,
    niche: nicheLabel,
    grade,
    signals,
    sampleSize: bench.posts.length,
    average: bench.average,
    topAverage: bench.topAverage,
    topCaptions: bench.top.map(({ post }) => post.caption),
  };
  // Built-in feedback fills whatever the AI left empty (or everything, without an AI provider).
  const built = fallbackFeedback(fallbackInput);
  const fromAi = ai?.result;
  // Rewrites only when the draft isn't strong yet; topped up from the built-in ones if the AI wrote fewer than 2.
  const suggestions = grade === "strong" ? [] : [...(fromAi?.suggestions ?? []), ...fallbackSuggestions(fallbackInput)].slice(0, 2);

  return {
    score,
    grade,
    verdict: fromAi?.verdict || built.verdict,
    summary: fromAi?.summary || built.summary,
    hook: fromAi?.hook.feedback ? fromAi.hook : built.hook,
    visual: fromAi?.visual ?? null,
    strengths: fromAi ? fromAi.strengths : built.strengths,
    fixes: fromAi?.fixes.length ? fromAi.fixes : built.fixes,
    signals,
    suggestions,
    benchmark: {
      platform,
      niche: nicheLabel,
      scope: bench.scope,
      sampleSize: bench.posts.length,
      average: bench.average,
      topAverage: bench.topAverage,
      bottomAverage: bench.bottomAverage,
      examples: bench.posts.slice(0, EXAMPLES),
    },
    provider: ai?.provider ?? "heuristic",
    generatedAt: now,
  };
}
