import "server-only";
import { getCache } from "../cache";
import { getRepo } from "../repo";
import { rankSimilarPosts } from "../similar";
import type { Platform, Post, SimulationBenchmark } from "../types";

// The simulator's 0–100 "virality score" is a post's engagement percentile among the stored posts of its
// platform: 50 = a typical stored post, 90 = better than 90% of them. Real posts and the draft share this
// scale, so a draft's prediction can be read against real posts in its niche ("34 vs. 71 for the top").
//
// The benchmark is the draft's niche: posts matching the user's topic plus the posts most similar to the
// draft's caption (lib/similar.ts), on the same platform — widened to other platforms, then to the whole
// platform, when the niche has too few stored posts.

const SAMPLE = 5000;
const SCALE_TTL = 10 * 60;
const CLUSTER = 40;
const MIN_CLUSTER = 8;

/** 101 engagement breakpoints (0th…100th percentile) for a platform; empty when it has no posts. */
async function platformScale(platform: Platform): Promise<number[]> {
  const cache = await getCache();
  const key = `simulator:scale:v1:${platform}`;
  const cached = await cache.get(key);
  if (cached) return JSON.parse(cached) as number[];
  const sample = (await (await getRepo()).posts.engagementSample(platform, SAMPLE)).sort((a, b) => a - b);
  const scale = sample.length ? Array.from({ length: 101 }, (_, i) => sample[Math.round((i / 100) * (sample.length - 1))]) : [];
  await cache.set(key, JSON.stringify(scale), SCALE_TTL);
  return scale;
}

/** Engagement → 0–100 on a platform scale: interpolated between breakpoints, mid-rank on ties. */
export function scoreOnScale(engagement: number, scale: number[]): number {
  if (!scale.length) return 0;
  const below = scale.filter((v) => v < engagement).length;
  const atOrBelow = scale.filter((v) => v <= engagement).length;
  if (atOrBelow > below) return Math.round((below + atOrBelow - 1) / 2);
  if (below === 0) return 0;
  if (below === scale.length) return 100;
  const i = below - 1;
  return Math.round(i + (engagement - scale[i]) / (scale[i + 1] - scale[i]));
}

async function scalesFor(platforms: Platform[]): Promise<Record<Platform, number[]>> {
  const unique = [...new Set(platforms)];
  const scales = await Promise.all(unique.map(platformScale));
  return Object.fromEntries(unique.map((p, i) => [p, scales[i]])) as Record<Platform, number[]>;
}

export interface Scored {
  post: Post;
  score: number;
}

export interface Benchmark {
  scope: SimulationBenchmark["scope"];
  /** Best score first. */
  posts: Scored[];
  top: Scored[];
  bottom: Scored[];
  average: number;
  topAverage: number;
  bottomAverage: number;
}

const mean = (items: Scored[]) => (items.length ? Math.round(items.reduce((sum, s) => sum + s.score, 0) / items.length) : 0);

/** Real posts to compare `draft` with, scored and split into top / bottom quartiles. */
export async function findBenchmark(draft: Post, niche: string | null): Promise<Benchmark> {
  const repo = await getRepo();
  const [nicheMatches, similar] = await Promise.all([
    niche ? repo.posts.search({ topic: niche, sort: ["newest"], page: 1, limit: 120 }).then((page) => page.items) : [],
    rankSimilarPosts(draft),
  ]);
  const ordered = [...new Map([...nicheMatches, ...similar].map((p) => [p.id, p])).values()];
  const samePlatform = ordered.filter((p) => p.platform === draft.platform);

  let scope: Benchmark["scope"] = "niche";
  let posts = samePlatform.slice(0, CLUSTER);
  if (posts.length < MIN_CLUSTER) {
    scope = "cross-platform";
    posts = [...samePlatform, ...ordered.filter((p) => p.platform !== draft.platform)].slice(0, CLUSTER);
  }
  if (posts.length < MIN_CLUSTER) {
    scope = "platform";
    posts = (await repo.posts.search({ platforms: [draft.platform], sort: ["newest"], page: 1, limit: CLUSTER })).items;
  }

  const scales = await scalesFor(posts.map((p) => p.platform));
  const scored = posts
    .map((post) => ({ post, score: scoreOnScale(post.engagementScore, scales[post.platform]) }))
    .sort((a, b) => b.score - a.score);
  const quartile = Math.max(1, Math.ceil(scored.length / 4));
  const top = scored.slice(0, quartile);
  const bottom = scored.slice(-quartile);
  return { scope, posts: scored, top, bottom, average: mean(scored), topAverage: mean(top), bottomAverage: mean(bottom) };
}
