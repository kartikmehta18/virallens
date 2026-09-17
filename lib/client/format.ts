const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });

export const formatCount = (n: number | null | undefined) => compact.format(n ?? 0);

export function timeAgo(iso: string): string {
  const seconds = Math.max(1, (Date.now() - new Date(iso).getTime()) / 1000);
  const units: [number, string][] = [
    [60 * 60 * 24 * 365, "y"],
    [60 * 60 * 24 * 30, "mo"],
    [60 * 60 * 24 * 7, "w"],
    [60 * 60 * 24, "d"],
    [60 * 60, "h"],
    [60, "m"],
  ];
  for (const [size, label] of units) if (seconds >= size) return `${Math.floor(seconds / size)}${label}`;
  return "now";
}

/** "5m ago", or "just now" for timestamps under a minute old. */
export function ago(iso: string): string {
  const t = timeAgo(iso);
  return t === "now" ? "just now" : `${t} ago`;
}

/** Compact time until a future timestamp ("3d", "5h"); "now" once it has passed. */
export function timeUntil(iso: string): string {
  return timeAgo(new Date(2 * Date.now() - new Date(iso).getTime()).toISOString());
}

const PROXIED_HOSTS = /(cdninstagram\.com|fbcdn\.net|licdn\.com|twimg\.com)$/;

/** Routes hotlink-protected social CDN media through /api/media. */
export function mediaSrc(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  try {
    return PROXIED_HOSTS.test(new URL(url).hostname) ? `/api/media?url=${encodeURIComponent(url)}` : url;
  } catch {
    return undefined;
  }
}

export const isVideoUrl = (url: string) => /\.(mp4|webm|mov|m3u8)(\?|$)/i.test(url) || url.includes("video");
