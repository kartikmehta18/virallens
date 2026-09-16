import { parseCreatorKeys } from "./creators";
import {
  DATE_RANGES,
  MEDIA_TYPES,
  PLATFORMS,
  SORTS,
  type DateRange,
  type MediaType,
  type Platform,
  type PostQuery,
  type SortKey,
} from "./types";

const listParam = <T extends string>(value: string | null, allowed: readonly T[]): T[] =>
  (value ?? "")
    .split(",")
    .map((v) => v.trim().toLowerCase())
    .filter((v): v is T => (allowed as readonly string[]).includes(v));

const RANGE_HOURS: Partial<Record<DateRange, number>> = { "24h": 24, "7d": 24 * 7, "30d": 24 * 30 };

function parseDate(value: string | null, endOfDay = false): Date | undefined {
  if (!value) return undefined;
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T${endOfDay ? "23:59:59.999" : "00:00:00"}Z` : value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

/** Parses /api/posts search params into a validated PostQuery. */
export function parsePostQuery(params: URLSearchParams): PostQuery {
  // sort=likes,comments blends several rankings; unknown keys are dropped, empty falls back to trending.
  const sorts = [...new Set(listParam<SortKey>(params.get("sort"), SORTS))];
  const sort: SortKey[] = sorts.length ? sorts : ["trending"];
  const range = (DATE_RANGES as readonly string[]).includes(params.get("dateRange") ?? "") ? (params.get("dateRange") as DateRange) : "all";
  const hours = RANGE_HOURS[range];

  return {
    topic: params.get("topic")?.trim().slice(0, 200) || undefined,
    platforms: listParam<Platform>(params.get("platform"), PLATFORMS),
    mediaTypes: listParam<MediaType>(params.get("mediaType"), MEDIA_TYPES),
    creators: parseCreatorKeys(params.get("creator")),
    sort,
    from: hours ? new Date(Date.now() - hours * 3_600_000) : range === "custom" ? parseDate(params.get("from")) : undefined,
    to: range === "custom" ? parseDate(params.get("to"), true) : undefined,
    page: Math.max(1, Number(params.get("page")) || 1),
    limit: Math.min(60, Math.max(1, Number(params.get("limit")) || 24)),
  };
}

export function parsePlatforms(value: unknown): Platform[] {
  const list = Array.isArray(value) ? value.map(String) : typeof value === "string" ? value.split(",") : [];
  const platforms = listParam<Platform>(list.join(","), PLATFORMS);
  return platforms.length ? [...new Set(platforms)] : [...PLATFORMS];
}
