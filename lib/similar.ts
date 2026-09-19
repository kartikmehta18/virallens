import "server-only";
import { getRepo } from "./repo";
import { keywordPattern, postHaystack } from "./search";
import { STOPWORDS, keywords } from "./text";
import type { Post } from "./types";

// "Similar posts" for the post modal. Candidates are found by content — posts sharing the source post's
// most distinctive words and hashtags (the same regex matching as search) — then scored:
//   content   rarer shared key words count more (IDF over the candidate pool)
//   tags      exact shared hashtags
//   wording   caption keyword overlap (Jaccard)
//   nudge     a little engagement, same media type
// and re-ranked for variety so one prolific author can't fill the rail. No AI needed: this runs on every
// modal open, so it stays a couple of cheap queries.

/** Candidate pool size; pages are served from the ranked pool. */
const POOL = 240;
const MAX_TERMS = 12;
/** Each extra post by an author already in the list is worth this much less (0.65, 0.42, …). */
const AUTHOR_DECAY = 0.65;

/** Words that show up in every creator post and say nothing about the subject. */
const GENERIC = new Set(
  (
    "follow following followers comment comments share shared like likes repost save saved link bio post posts " +
    "thoughts agree today tomorrow week check join free dm click subscribe thanks thank please want need know " +
    "think make made really going help people everyone anyone something things thing time year years day days"
  ).split(" "),
);

/** The source post's most distinctive words: its hashtags, then frequent longer caption words. */
export function keyTerms(post: Post): string[] {
  const tags = post.tags.map((t) => t.toLowerCase()).filter((t) => t.length >= 2 && !STOPWORDS.has(t) && !GENERIC.has(t));
  const counts = new Map<string, number>();
  for (const word of post.caption.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? []) {
    if (!STOPWORDS.has(word) && !GENERIC.has(word) && !/^\d+$/.test(word)) counts.set(word, (counts.get(word) ?? 0) + 1);
  }
  const words = [...counts]
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .map(([word]) => word)
    .filter((word) => !tags.includes(word));
  return [...new Set([...tags.slice(0, 6), ...words])].slice(0, MAX_TERMS);
}

const authorKey = (post: Post) => `${post.platform}:${post.authorHandle.toLowerCase()}`;

/** The full ranked list of similar posts (up to POOL); callers page through it. */
export async function rankSimilarPosts(post: Post): Promise<Post[]> {
  const terms = keyTerms(post);
  if (!terms.length) return [];
  const patterns = terms.map(keywordPattern);
  const candidates = await (
    await getRepo()
  ).posts.similarCandidates({ excludeId: post.id, patterns, minMatch: terms.length >= 4 ? 2 : 1, limit: POOL });
  if (!candidates.length) return [];

  const regexes = patterns.map((p) => new RegExp(p, "iu"));
  const hits = candidates.map((c) => {
    const text = postHaystack(c);
    return regexes.map((r) => r.test(text));
  });
  // Rarer shared words say more about "same subject" than words half the pool uses.
  const idf = regexes.map((_, i) => Math.log(1 + candidates.length / (1 + hits.filter((h) => h[i]).length)));
  const idfTotal = idf.reduce((a, b) => a + b, 0) || 1;

  const sourceTags = new Set(post.tags.map((t) => t.toLowerCase()));
  const sourceWords = keywords(post.caption);
  const maxTrending = Math.log1p(Math.max(1, ...candidates.map((c) => c.trendingScore)));
  const sameTopic = (c: Post) => !post.topic.startsWith("@") && c.topic.toLowerCase() === post.topic.toLowerCase();

  const scored = candidates.map((candidate, index) => {
    const content = hits[index].reduce((sum, hit, i) => sum + (hit ? idf[i] : 0), 0) / idfTotal;
    const sharedTags = candidate.tags.filter((t) => sourceTags.has(t.toLowerCase())).length;
    const words = keywords(candidate.caption);
    const overlap = [...words].filter((w) => sourceWords.has(w)).length;
    const jaccard = overlap / Math.max(1, words.size + sourceWords.size - overlap);
    const score =
      content * 0.6 +
      Math.min(sharedTags, 3) * 0.08 +
      jaccard * 0.25 +
      (sameTopic(candidate) ? 0.05 : 0) +
      (candidate.mediaType === post.mediaType ? 0.02 : 0) +
      (Math.log1p(candidate.trendingScore) / maxTrending) * 0.05;
    return { candidate, score };
  });

  // Greedy re-rank for variety: repeated authors (including the source post's own) decay.
  const shown = new Map([[authorKey(post), 1]]);
  const remaining = scored.sort((a, b) => b.score - a.score);
  const ranked: Post[] = [];
  while (remaining.length) {
    let best = 0;
    let bestScore = -Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const adjusted = remaining[i].score * AUTHOR_DECAY ** (shown.get(authorKey(remaining[i].candidate)) ?? 0);
      if (adjusted > bestScore) {
        bestScore = adjusted;
        best = i;
      }
    }
    const [pick] = remaining.splice(best, 1);
    ranked.push(pick.candidate);
    shown.set(authorKey(pick.candidate), (shown.get(authorKey(pick.candidate)) ?? 0) + 1);
  }
  return ranked;
}

/** One page of similar posts. */
export async function findSimilarPosts(post: Post, page = 1, limit = 12): Promise<{ items: Post[]; hasMore: boolean }> {
  const ranked = await rankSimilarPosts(post);
  const start = (page - 1) * limit;
  return { items: ranked.slice(start, start + limit), hasMore: start + limit < ranked.length };
}
