import { PLATFORMS, type CreatorRef, type Platform } from "./types";

// Isomorphic helpers for creator identity: a creator is (platform, handle).

const HANDLE_PATTERN = /^[A-Za-z0-9_.-]{1,100}$/;

export const normalizeHandle = (handle: string) => handle.trim().replace(/^@/, "").replace(/\/+$/, "").toLowerCase();

export const creatorKey = (ref: CreatorRef) => `${ref.platform}:${normalizeHandle(ref.handle)}`;

/** Parses "x:handle" keys (as used in URLs); invalid entries are dropped. */
export function parseCreatorKey(key: string): CreatorRef | null {
  const index = key.indexOf(":");
  if (index < 1) return null;
  const platform = key.slice(0, index) as Platform;
  const handle = normalizeHandle(key.slice(index + 1));
  return PLATFORMS.includes(platform) && HANDLE_PATTERN.test(handle) ? { platform, handle } : null;
}

export function parseCreatorKeys(value: string | null | undefined): CreatorRef[] {
  const seen = new Set<string>();
  const refs: CreatorRef[] = [];
  for (const part of (value ?? "").split(",")) {
    const ref = parseCreatorKey(part.trim());
    if (ref && !seen.has(creatorKey(ref))) {
      seen.add(creatorKey(ref));
      refs.push(ref);
    }
  }
  return refs.slice(0, 50);
}

export const isValidHandle = (handle: string) => HANDLE_PATTERN.test(normalizeHandle(handle));

export function creatorProfileUrl({ platform, handle }: CreatorRef): string {
  const h = encodeURIComponent(normalizeHandle(handle));
  if (platform === "x") return `https://x.com/${h}`;
  if (platform === "linkedin") return `https://www.linkedin.com/in/${h}/`;
  return `https://www.instagram.com/${h}/`;
}

/** In-app profile page for a creator. */
export const creatorPath = ({ platform, handle }: CreatorRef) => `/creators/${platform}/${encodeURIComponent(normalizeHandle(handle))}`;

/**
 * Accepts a profile URL (x.com/…, twitter.com/…, linkedin.com/in/…, instagram.com/…) or a bare @handle
 * with an explicit platform, and returns the creator reference.
 */
export function parseCreatorInput(input: string, fallbackPlatform: Platform): CreatorRef | null {
  const value = input.trim();
  const url = value.match(/^(?:https?:\/\/)?(?:www\.|m\.)?([a-z.]+)\/(.+)$/i);
  if (url) {
    const host = url[1].toLowerCase();
    const segments = url[2].split(/[/?#]/).filter(Boolean);
    let ref: CreatorRef | null = null;
    if (host === "x.com" || host === "twitter.com") ref = { platform: "x", handle: segments[0] ?? "" };
    else if (host.endsWith("linkedin.com") && (segments[0] === "in" || segments[0] === "company"))
      ref = { platform: "linkedin", handle: segments[1] ?? "" };
    else if (host.endsWith("instagram.com")) ref = { platform: "instagram", handle: segments[0] ?? "" };
    return ref && isValidHandle(ref.handle) ? { ...ref, handle: normalizeHandle(ref.handle) } : null;
  }
  return isValidHandle(value) ? { platform: fallbackPlatform, handle: normalizeHandle(value) } : null;
}
