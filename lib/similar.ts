import "server-only";
import { getRepo } from "./repo";
import { keywords } from "./text";
import type { Post } from "./types";

/**
 * V1 similarity (spec §5.4): shared topic + overlapping hashtags + caption keyword overlap,
 * with trending score as the tie-breaker. Swap this for pgvector/embeddings later without touching callers.
 */
export async function findSimilarPosts(post: Post, limit = 12): Promise<Post[]> {
  const repo = await getRepo();
  const candidates = await repo.posts.similarCandidates({
    excludeId: post.id,
    topic: post.topic,
    platform: post.platform,
    tags: post.tags,
    limit: 150,
  });

  const tags = new Set(post.tags);
  const words = keywords(post.caption);
  const maxTrending = Math.max(1, ...candidates.map((c) => c.trendingScore));

  const scored = candidates.map((candidate) => {
    const sharedTags = candidate.tags.filter((t) => tags.has(t)).length;
    const candidateWords = keywords(candidate.caption);
    const overlap = [...candidateWords].filter((w) => words.has(w)).length;
    const jaccard = overlap / Math.max(1, words.size + candidateWords.size - overlap);
    const score =
      (candidate.topic.toLowerCase() === post.topic.toLowerCase() ? 3 : 0) +
      sharedTags * 2 +
      jaccard * 6 +
      (candidate.platform === post.platform ? 0.5 : 0) +
      (candidate.mediaType === post.mediaType ? 0.5 : 0) +
      (candidate.trendingScore / maxTrending) * 1.5;
    return { candidate, score };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.candidate);
}
