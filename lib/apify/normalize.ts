import { extractHashtags, normalizeTags } from "../text";
import type { MediaType, Platform, PostInput } from "../types";
import type { RawItem } from "./client";

// Converts each actor's raw output into the unified PostInput shape.
// Actors change their output over time, so every field is read defensively with fallbacks.

function get(obj: unknown, path: string): unknown {
  let cur = obj;
  for (const key of path.split(".")) {
    if (cur === null || cur === undefined) return undefined;
    cur = (cur as Record<string, unknown>)[key];
  }
  return cur;
}

function first<T = unknown>(obj: unknown, ...paths: string[]): T | undefined {
  for (const path of paths) {
    const value = get(obj, path);
    if (value !== undefined && value !== null && value !== "") return value as T;
  }
  return undefined;
}

const str = (obj: unknown, ...paths: string[]) => {
  const value = first(obj, ...paths);
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
};

const num = (obj: unknown, ...paths: string[]) => {
  const value = Number(first(obj, ...paths));
  return Number.isFinite(value) && value > 0 ? Math.round(value) : 0;
};

const optionalNum = (obj: unknown, ...paths: string[]) => {
  const value = first(obj, ...paths);
  return value === undefined ? null : num(obj, ...paths);
};

function date(obj: unknown, ...paths: string[]): string {
  for (const path of paths) {
    const value = get(obj, path);
    if (value === undefined || value === null || value === "") continue;
    const parsed = typeof value === "number" ? new Date(value < 1e12 ? value * 1000 : value) : new Date(String(value));
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  return new Date().toISOString();
}

const urls = (value: unknown): string[] =>
  (Array.isArray(value) ? value : [])
    .map((item) => (typeof item === "string" ? item : str(item, "url", "displayUrl", "src", "imageUrl")))
    .filter((url) => /^https?:\/\//.test(url));

function stripQuery(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return url;
  }
}

function finalize(input: PostInput): PostInput | null {
  if (!input.postUrl || (!input.caption && input.mediaUrls.length === 0)) return null;
  const mediaType: MediaType =
    input.mediaType === "carousel" && input.mediaUrls.length < 2 ? (input.mediaUrls.length ? "image" : "text") : input.mediaType;
  return {
    ...input,
    mediaType,
    thumbnailUrl: input.thumbnailUrl ?? (mediaType === "image" || mediaType === "carousel" ? (input.mediaUrls[0] ?? null) : null),
    tags: normalizeTags(input.tags, extractHashtags(input.caption)),
  };
}

export function normalizeX(raw: RawItem, topic: string): PostInput | null {
  if (raw.noResults || (raw.type && raw.type !== "tweet")) return null;
  const media = (first<RawItem[]>(raw, "extendedEntities.media", "media", "entities.media") ?? []) as RawItem[];
  const videos = media.filter((m) => m.type === "video" || m.type === "animated_gif");
  const photos = media.filter((m) => !videos.includes(m));

  const bestVideo = (m: RawItem) => {
    const variants = ((get(m, "video_info.variants") as RawItem[]) ?? []).filter((v) => v.content_type === "video/mp4");
    variants.sort((a, b) => Number(b.bitrate ?? 0) - Number(a.bitrate ?? 0));
    return str(variants[0], "url") || str(m, "videoUrl", "url");
  };

  const mediaType: MediaType = videos.length ? "video" : photos.length > 1 ? "carousel" : photos.length ? "image" : "text";
  const mediaUrls = videos.length
    ? [bestVideo(videos[0])].filter(Boolean)
    : photos.map((m) => str(m, "media_url_https", "media_url", "url")).filter(Boolean);

  const handle = str(raw, "author.userName", "author.screen_name", "user.screen_name", "username");
  const id = str(raw, "id", "id_str");

  return finalize({
    platform: "x",
    authorName: str(raw, "author.name", "user.name") || handle,
    authorHandle: handle,
    authorAvatarUrl: str(raw, "author.profilePicture", "author.profile_image_url_https", "user.profile_image_url_https") || null,
    caption: str(raw, "fullText", "full_text", "text"),
    mediaType,
    mediaUrls,
    thumbnailUrl: videos.length ? str(videos[0], "media_url_https", "thumbnailUrl") || null : null,
    postUrl: stripQuery(str(raw, "url", "twitterUrl") || (handle && id ? `https://x.com/${handle}/status/${id}` : "")),
    likeCount: num(raw, "likeCount", "favorite_count"),
    commentCount: num(raw, "replyCount", "reply_count"),
    shareCount: num(raw, "retweetCount", "retweet_count") + num(raw, "quoteCount", "quote_count"),
    viewCount: optionalNum(raw, "viewCount", "views.count"),
    topic,
    tags: ((get(raw, "entities.hashtags") as RawItem[]) ?? []).map((h) => str(h, "text", "tag")),
    publishedAt: date(raw, "createdAt", "created_at"),
  });
}

export function normalizeInstagram(raw: RawItem, topic: string): PostInput | null {
  if (raw.error) return null;
  const type = str(raw, "type", "productType").toLowerCase();
  const children = (first<RawItem[]>(raw, "childPosts", "children") ?? []) as RawItem[];
  const isVideo = type === "video" || type === "clips" || Boolean(raw.videoUrl);
  const isCarousel = type === "sidecar" || type === "carousel" || children.length > 1;

  const carouselUrls = children.length ? children.map((c) => str(c, "displayUrl", "imageUrl")).filter(Boolean) : urls(raw.images);

  const mediaType: MediaType = isCarousel ? "carousel" : isVideo ? "video" : "image";
  const mediaUrls =
    mediaType === "carousel"
      ? carouselUrls
      : mediaType === "video"
        ? [str(raw, "videoUrl")].filter(Boolean)
        : [str(raw, "displayUrl", "imageUrl")].filter(Boolean);

  const shortCode = str(raw, "shortCode", "shortcode", "code");
  const handle = str(raw, "ownerUsername", "owner.username");

  return finalize({
    platform: "instagram",
    authorName: str(raw, "ownerFullName", "owner.full_name") || handle,
    authorHandle: handle,
    authorAvatarUrl: str(raw, "ownerProfilePicUrl", "owner.profile_pic_url") || null,
    caption: str(raw, "caption", "text"),
    mediaType,
    mediaUrls,
    thumbnailUrl: str(raw, "displayUrl", "thumbnailUrl") || null,
    postUrl: stripQuery(str(raw, "url") || (shortCode ? `https://www.instagram.com/p/${shortCode}` : "")),
    likeCount: num(raw, "likesCount", "likes"),
    commentCount: num(raw, "commentsCount", "comments"),
    shareCount: num(raw, "sharesCount", "reshareCount"),
    viewCount: optionalNum(raw, "videoPlayCount", "videoViewCount", "playCount"),
    topic,
    tags: (raw.hashtags as string[]) ?? [],
    publishedAt: date(raw, "timestamp", "takenAtTimestamp", "taken_at"),
  });
}

export function normalizeLinkedIn(raw: RawItem, topic: string): PostInput | null {
  if (raw.type && !["post", "repost", "article"].includes(String(raw.type))) return null;
  const images = [...urls(raw.postImages), ...urls(raw.images), ...urls(raw.image ? [raw.image] : [])];
  const videoUrl = str(raw, "postVideo.videoUrl", "video.url", "videoUrl");
  const mediaType: MediaType = videoUrl ? "video" : images.length > 1 ? "carousel" : images.length ? "image" : "text";

  const handle = str(raw, "author.publicIdentifier", "author.universalName", "authorProfileId", "authorUsername");
  const reactions = (raw.engagement as RawItem | undefined)?.reactions;
  const reactionTotal = Array.isArray(reactions) ? reactions.reduce((sum, r) => sum + num(r, "count"), 0) : 0;

  return finalize({
    platform: "linkedin",
    authorName: str(raw, "author.name", "authorName", "author.firstName") || handle || "LinkedIn member",
    authorHandle: handle || str(raw, "author.name", "authorName").toLowerCase().replace(/\s+/g, "-"),
    authorAvatarUrl: str(raw, "author.avatar.url", "author.picture", "authorProfilePicture", "author.image") || null,
    caption: str(raw, "content", "text", "commentary", "postText"),
    mediaType,
    mediaUrls: videoUrl ? [videoUrl] : images,
    thumbnailUrl: str(raw, "postVideo.thumbnailUrl", "video.thumbnail") || null,
    postUrl: stripQuery(str(raw, "linkedinUrl", "url", "postUrl", "shareUrl")),
    likeCount: num(raw, "engagement.likes", "numLikes", "likesCount", "reactionsCount", "stats.total_reactions") || reactionTotal,
    commentCount: num(raw, "engagement.comments", "numComments", "commentsCount", "stats.comments"),
    shareCount: num(raw, "engagement.shares", "numShares", "repostsCount", "sharesCount", "stats.reposts"),
    viewCount: optionalNum(raw, "engagement.views", "numViews", "viewsCount"),
    topic,
    tags: [],
    publishedAt: date(raw, "postedAt.timestamp", "postedAt.date", "postedAtISO", "postedAtTimestamp", "publishedAt", "date"),
  });
}

export const NORMALIZERS: Record<Platform, (raw: RawItem, topic: string) => PostInput | null> = {
  x: normalizeX,
  instagram: normalizeInstagram,
  linkedin: normalizeLinkedIn,
};
