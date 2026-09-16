// Shared types used by both server and client code.

export const PLATFORMS = ["x", "linkedin", "instagram"] as const;
export type Platform = (typeof PLATFORMS)[number];

export const MEDIA_TYPES = ["image", "video", "carousel", "text"] as const;
export type MediaType = (typeof MEDIA_TYPES)[number];

export const SORTS = ["trending", "likes", "comments", "shares", "newest", "engagement"] as const;
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
  topic: string;
  tags: string[];
  aiBreakdown: AiBreakdown | null;
  publishedAt: string;
  fetchedAt: string;
}

/** A normalized post before it has been stored (no id / scores yet). */
export type PostInput = Omit<Post, "id" | "engagementScore" | "trendingScore" | "aiBreakdown" | "fetchedAt">;

export interface PostQuery {
  topic?: string;
  platforms?: Platform[];
  mediaTypes?: MediaType[];
  /** Only posts by these creators. */
  creators?: CreatorRef[];
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
}

export interface User {
  id: string;
  username: string | null;
  email: string;
  name: string | null;
  isTest: boolean;
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
  items?: number;
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
  dbEnabled: boolean;
  apifyEnabled: boolean;
  aiProvider: AiBreakdown["provider"];
  user: User | null;
}

export interface TimelinePoint {
  date: string;
  posts: number;
  engagement: number;
}
