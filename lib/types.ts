// Shared types used by both server and client code.

export const PLATFORMS = ["x", "linkedin", "instagram"] as const;
export type Platform = (typeof PLATFORMS)[number];

export const MEDIA_TYPES = ["image", "video", "carousel", "text"] as const;
export type MediaType = (typeof MEDIA_TYPES)[number];

export const SORTS = ["trending", "likes", "comments", "shares", "newest", "engagement", "memes"] as const;
export type SortKey = (typeof SORTS)[number];

export const DATE_RANGES = ["24h", "7d", "30d", "all", "custom"] as const;
export type DateRange = (typeof DATE_RANGES)[number];

export interface AiBreakdown {
  bullets: string[];
  provider: "anthropic" | "openai" | "gemini" | "heuristic";
  generatedAt: string;
}

/** Unified post shape across X, LinkedIn and Instagram (dates serialized as ISO strings). */
export interface Post {
  id: string;
  platform: Platform;
  authorName: string;
  authorHandle: string;
  authorAvatarUrl: string | null;
  caption: string;
  mediaType: MediaType;
  mediaUrls: string[];
  thumbnailUrl: string | null;
  postUrl: string;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  viewCount: number | null;
  engagementScore: number;
  trendingScore: number;
  /** 0–100 "how meme-like is this?" heuristic (see lib/meme.ts); powers the Memes sort. */
  memeScore: number;
  topic: string;
  tags: string[];
  aiBreakdown: AiBreakdown | null;
  publishedAt: string;
  fetchedAt: string;
}

/** A normalized post before it has been stored (no id / scores yet). */
export type PostInput = Omit<Post, "id" | "engagementScore" | "trendingScore" | "memeScore" | "aiBreakdown" | "fetchedAt">;

export interface PostQuery {
  topic?: string;
  platforms?: Platform[];
  mediaTypes?: MediaType[];
  /** Only posts by these creators. */
  creators?: CreatorRef[];
  /** With a topic: these creators' matching posts are ranked first (everyone else's still show). */
  preferCreators?: CreatorRef[];
  /** Only these post ids (e.g. the posts a "load more" fetch just added), still filtered and sorted. */
  ids?: string[];
  /**
   * With a topic: related searches (AI suggestions, spelling fix) whose matches are included too — "ai" also
   * finds "chatgpt" and "llm" posts. They rank alongside the weakest direct matches, then by the chosen sort.
   */
  related?: string[];
  /** One or more sort keys. Several keys blend their rankings (average percentile rank). */
  sort: SortKey[];
  from?: Date;
  to?: Date;
  page: number;
  limit: number;
}

export interface PostPage {
  items: Post[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
  /** With preferCreators: how many of `total` are by those creators (they come first). */
  creatorMatches?: number;
}

export const ROLES = ["user", "admin"] as const;
export type Role = (typeof ROLES)[number];

export interface User {
  id: string;
  username: string | null;
  /** Optional for admin-created (access key) accounts. */
  email: string | null;
  name: string | null;
  /** Profile picture from Google, when the account is linked. */
  avatarUrl: string | null;
  role: Role;
  isTest: boolean;
  createdAt: string;
}

/** A user as seen on the admin page, including their (decrypted) access key. */
export interface AdminUser extends User {
  disabled: boolean;
  /** Signed in with Google at least once (their Google account is linked). */
  googleLinked: boolean;
  /** null when no key was issued, or it can't be decrypted (AUTH_SECRET changed) — regenerate to fix. */
  accessKey: string | null;
  hasAccessKey: boolean;
  accessKeyCreatedAt: string | null;
  lastLoginAt: string | null;
}

export type InviteStatus = "pending" | "used" | "expired";

export interface Invite {
  id: string;
  email: string | null;
  name: string | null;
  role: Role;
  status: InviteStatus;
  /** Full sign-up link; null if it can't be decrypted. */
  link: string | null;
  createdById: string;
  expiresAt: string;
  usedAt: string | null;
  usedById: string | null;
  createdAt: string;
}

export interface BoardSummary {
  id: string;
  name: string;
  createdAt: string;
  postCount: number;
  covers: string[];
}

export interface BoardDetail extends BoardSummary {
  posts: Post[];
}

export type ScrapeStatus = "queued" | "running" | "succeeded" | "failed";

export interface ScrapeRunInfo {
  platform: Platform;
  source: "apify" | "demo";
  status: "pending" | "running" | "succeeded" | "failed";
  runId?: string;
  /** "Load more" step (1, 2, …): which next slice this run asked the platform for. */
  step?: number;
  /** Set when a load-more step searched a related query instead of the topic itself. */
  query?: string;
  /** First fetch: the related searches fetched after the topic's own posts were stored (the "Also showing" chips). */
  related?: string[];
  items?: number;
  /** Posts this run added that weren't stored before (capped). */
  newPostIds?: string[];
  error?: string;
}

export interface ScrapeJob {
  id: string;
  topic: string;
  platforms: Platform[];
  status: ScrapeStatus;
  error: string | null;
  postsFound: number;
  runs: ScrapeRunInfo[];
  userId: string | null;
  createdAt: string;
  finishedAt: string | null;
}

export interface WatchedTopic {
  id: string;
  userId: string;
  topic: string;
  platforms: Platform[];
  thresholdScore: number;
  lastCheckedAt: string | null;
  createdAt: string;
}

/** A creator is identified by platform + handle (handles are compared case-insensitively). */
export interface CreatorRef {
  platform: Platform;
  handle: string;
}

export interface CreatorStats {
  postCount: number;
  totalLikes: number;
  totalComments: number;
  totalShares: number;
  totalEngagement: number;
  avgEngagement: number;
  bestTrending: number;
  lastPostAt: string | null;
}

/** A creator the user saved as a favorite. */
export interface FavoriteCreator extends CreatorRef {
  id: string;
  userId: string;
  name: string;
  avatarUrl: string | null;
  lastFetchedAt: string | null;
  createdAt: string;
}

export interface FavoriteCreatorWithStats extends FavoriteCreator {
  stats: CreatorStats;
}

export interface CreatorProfile extends CreatorRef {
  name: string;
  avatarUrl: string | null;
  profileUrl: string;
  stats: CreatorStats;
  /** Set when the signed-in user has saved this creator. */
  favorite: FavoriteCreator | null;
}

export interface SessionInfo {
  testMode: boolean;
  /** "invite": sign-up needs an invite link, the app requires sign-in. "open": anyone can register. */
  accessMode: "invite" | "open";
  dbEnabled: boolean;
  apifyEnabled: boolean;
  aiProvider: AiBreakdown["provider"];
  /** GOOGLE_CLIENT_ID/SECRET configured (and server accounts in use). */
  googleEnabled: boolean;
  user: User | null;
}

/** AI reading of a search query (GET /api/search/understand). */
export interface QueryInsight {
  /** The query with spelling fixed, or null when it was already fine. */
  corrected: string | null;
  /** Up to 4 short related searches, most useful first. */
  related: string[];
}

export interface TimelinePoint {
  date: string;
  posts: number;
  engagement: number;
}

// ── Virality simulator (POST /api/simulate) ────────────────────────────────────────────────────────────

/** strong ≥ 70, average 40–69, weak < 40 — rewrites are suggested for anything below strong. */
export type SimulationGrade = "strong" | "average" | "weak";
export type SignalStatus = "good" | "warn" | "bad";

/** One structural check of the draft against the benchmark's top performers. */
export interface SimulationSignal {
  key: string;
  label: string;
  yours: string;
  top: string;
  status: SignalStatus;
  /** What to do about it (or why it's fine). */
  tip: string;
}

/** A diff-style fix: what's wrong, what to change, and a concrete rewrite. */
export interface SimulationFix {
  issue: string;
  change: string;
  example: string;
}

/** A complete rewrite of the draft, ready to publish. */
export interface SimulationSuggestion {
  hook: string;
  content: string;
  why: string;
}

export interface SimulationBenchmark {
  platform: Platform;
  /** The niche the draft was compared in: the user's topic, or the draft's own key words. */
  niche: string;
  /** "niche": same subject + platform; "cross-platform": same subject, any platform; "platform": no niche match. */
  scope: "niche" | "cross-platform" | "platform";
  sampleSize: number;
  average: number;
  /** Average score of the top / bottom quartile of the benchmark. */
  topAverage: number;
  bottomAverage: number;
  /** The best-scoring real posts in the benchmark. */
  examples: { post: Post; score: number }[];
}

export interface SimulationResult {
  /** Predicted 0–100 virality score: the engagement percentile among stored posts on the platform. */
  score: number;
  grade: SimulationGrade;
  verdict: string;
  summary: string;
  hook: { rating: "weak" | "average" | "strong"; feedback: string };
  /** Feedback on the uploaded image (AI providers only). */
  visual: string | null;
  strengths: string[];
  fixes: SimulationFix[];
  signals: SimulationSignal[];
  /** Two rewrites (hook + content) — only when the draft isn't strong yet. */
  suggestions: SimulationSuggestion[];
  benchmark: SimulationBenchmark;
  provider: AiBreakdown["provider"];
  generatedAt: string;
}
