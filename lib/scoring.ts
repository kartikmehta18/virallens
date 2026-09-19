import { memeScore } from "./meme";
import type { MediaType } from "./types";

interface Counts {
  likeCount: number;
  commentCount: number;
  shareCount: number;
  viewCount: number | null;
}

/** Weighted cross-platform engagement (spec §6). */
export function engagementScore({ likeCount, commentCount, shareCount, viewCount }: Counts): number {
  return likeCount * 1 + commentCount * 3 + shareCount * 5 + (viewCount ?? 0) * 0.05;
}

/** Time-decayed virality, like Reddit's "hot": engagement / (hours + 2)^1.5. */
export function trendingScore(engagement: number, publishedAt: Date | string, now = Date.now()): number {
  const hours = Math.max(0, (now - new Date(publishedAt).getTime()) / 3_600_000);
  return engagement / Math.pow(hours + 2, 1.5);
}

/** Every derived score for a post — kept together so both repository backends stay in sync. */
export function scorePost<T extends Counts & { publishedAt: string; caption: string; tags: string[]; mediaType: MediaType }>(post: T) {
  const engagement = engagementScore(post);
  return {
    engagementScore: round(engagement),
    trendingScore: round(trendingScore(engagement, post.publishedAt)),
    memeScore: memeScore(post),
  };
}

const round = (n: number) => Math.round(n * 1000) / 1000;
