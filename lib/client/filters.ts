import { creatorKey, parseCreatorKeys } from "../creators";
import { DATE_RANGES, MEDIA_TYPES, PLATFORMS, SORTS, type DateRange, type MediaType, type Platform, type SortKey } from "../types";

export interface ExploreFilters {
  topic: string;
  platforms: Platform[];
  /** Selected sorts in the order they were picked; several blend their rankings. */
  sort: SortKey[];
  dateRange: DateRange;
  from: string;
  to: string;
  mediaTypes: MediaType[];
  /** Creator keys ("platform:handle") — only posts by these creators. */
  creators: string[];
}

export const DEFAULT_FILTERS: ExploreFilters = {
  topic: "",
  platforms: [],
  sort: ["trending"],
  dateRange: "all",
  from: "",
  to: "",
  mediaTypes: [],
  creators: [],
};

const pickList = <T extends string>(value: string | null, allowed: readonly T[]) =>
  (value ?? "").split(",").filter((v): v is T => (allowed as readonly string[]).includes(v));

const pickOne = <T extends string>(value: string | null, allowed: readonly T[], fallback: T) =>
  (allowed as readonly string[]).includes(value ?? "") ? (value as T) : fallback;

/** Parses URL params; anything missing falls back to `defaults` (the user's saved explore defaults). */
export function filtersFromParams(params: URLSearchParams, defaults: ExploreFilters = DEFAULT_FILTERS): ExploreFilters {
  return {
    topic: params.get("topic") ?? "",
    platforms: params.has("platform") ? pickList(params.get("platform"), PLATFORMS) : defaults.platforms,
    sort:
      params.has("sort") && pickList(params.get("sort"), SORTS).length ? [...new Set(pickList(params.get("sort"), SORTS))] : defaults.sort,
    dateRange: pickOne(params.get("dateRange"), DATE_RANGES, defaults.dateRange),
    from: params.get("from") ?? "",
    to: params.get("to") ?? "",
    mediaTypes: pickList(params.get("mediaType"), MEDIA_TYPES),
    creators: parseCreatorKeys(params.get("creator")).map(creatorKey),
  };
}

/** Serializes filters to query params, omitting values equal to `defaults` to keep URLs short. */
export function filtersToParams(filters: ExploreFilters, defaults: ExploreFilters = DEFAULT_FILTERS): URLSearchParams {
  const params = new URLSearchParams();
  const samePlatforms = [...filters.platforms].sort().join(",") === [...defaults.platforms].sort().join(",");
  if (filters.topic.trim()) params.set("topic", filters.topic.trim());
  if (!samePlatforms) params.set("platform", filters.platforms.join(","));
  if (filters.sort.join(",") !== defaults.sort.join(",")) params.set("sort", filters.sort.join(","));
  if (filters.dateRange !== defaults.dateRange) params.set("dateRange", filters.dateRange);
  if (filters.dateRange === "custom") {
    if (filters.from) params.set("from", filters.from);
    if (filters.to) params.set("to", filters.to);
  }
  if (filters.mediaTypes.length) params.set("mediaType", filters.mediaTypes.join(","));
  if (filters.creators.length) params.set("creator", filters.creators.join(","));
  return params;
}

export const SORT_LABELS: Record<SortKey, string> = {
  trending: "Trending",
  engagement: "Top engagement",
  likes: "Most liked",
  comments: "Most commented",
  shares: "Most shared",
  newest: "Newest",
  memes: "Memes",
};

export const RANGE_LABELS: Record<DateRange, string> = {
  "24h": "Last 24h",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  all: "Any time",
  custom: "Custom",
};

export const MEDIA_LABELS: Record<MediaType, string> = { image: "Image", video: "Video", carousel: "Carousel", text: "Text" };
export const PLATFORM_LABELS: Record<Platform, string> = { x: "X", linkedin: "LinkedIn", instagram: "Instagram" };
