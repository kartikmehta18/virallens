import { useCallback, useEffect, useRef, useState } from "react";

// Over HTTP/1.1 (e.g. local http://localhost) a browser opens at most 6 connections per host. Grid media
// is proxied through our own /api/media, and social CDNs can be very slow for big files — some LinkedIn
// "images" are multi-MB animated GIFs that take 30s+ — so six of those would hold every connection and
// stall the posts API, page chunks and navigation behind them. Grid tiles therefore take a download slot
// first: at most MAX_SLOTS proxied downloads at once, leaving the rest free for the app. HTTP/2 and
// HTTP/3 multiplex requests over one connection, so there the queue is skipped entirely.

const MAX_SLOTS = 3;
let active = 0;
const waiting: (() => void)[] = [];
let multiplexed: boolean | null = null;

function isMultiplexed(): boolean {
  if (multiplexed === null) {
    try {
      const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
      multiplexed = /^h[23]/i.test(nav?.nextHopProtocol ?? "");
    } catch {
      multiplexed = false;
    }
  }
  return multiplexed;
}

function pump() {
  while (active < MAX_SLOTS && waiting.length) waiting.shift()!();
}

/** Calls `onGranted` once a slot is free; the returned function releases the slot (or leaves the queue). */
function requestSlot(onGranted: () => void): () => void {
  if (isMultiplexed()) {
    onGranted();
    return () => {};
  }
  let state: "waiting" | "active" | "done" = "waiting";
  const grant = () => {
    state = "active";
    active++;
    onGranted();
  };
  if (active < MAX_SLOTS) grant();
  else waiting.push(grant);
  return () => {
    if (state === "waiting") waiting.splice(waiting.indexOf(grant), 1);
    else if (state === "active") {
      active--;
      pump();
    }
    state = "done";
  };
}

/**
 * Defers a grid tile's media URL until the tile is near the viewport *and* a download slot is free.
 * Attach `ref` to the element, render `src` (undefined until granted), and call `settled` from
 * onLoad / onLoadedMetadata / onError so the next tile can start.
 */
export function useQueuedMedia<T extends HTMLElement>(src: string | undefined) {
  const ref = useRef<T>(null);
  const [grantedSrc, setGrantedSrc] = useState<string>();
  const release = useRef<(() => void) | null>(null);

  useEffect(() => {
    const node = ref.current;
    if (!src || !node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        release.current = requestSlot(() => setGrantedSrc(src));
      },
      { rootMargin: "400px 0px" },
    );
    observer.observe(node);
    return () => {
      observer.disconnect();
      release.current?.();
      release.current = null;
    };
  }, [src]);

  const settled = useCallback(() => {
    release.current?.();
    release.current = null;
  }, []);

  return { ref, src: grantedSrc === src ? src : undefined, settled };
}
