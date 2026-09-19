"use client";

import { useQuery } from "@tanstack/react-query";
import { ApiRequestError, api } from "@/lib/client/api";
import type { PostPage, TimelinePoint } from "@/lib/types";

const retry = (count: number, error: Error) => !(error instanceof ApiRequestError && error.status === 401) && count < 2;

/**
 * Live data behind the landing page visuals (falls back gracefully while loading). These read the public
 * /api/landing endpoints, so the marketing page keeps its imagery for signed-out visitors in invite-only mode.
 */
export function useTrendingPosts(limit: number, mediaType?: string) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (mediaType) params.set("mediaType", mediaType);
  return useQuery({
    queryKey: ["landing-posts", params.toString()],
    queryFn: () => api<PostPage>(`/api/landing/posts?${params}`),
    staleTime: 5 * 60_000,
    retry,
  });
}

export function useTimeline(days: number) {
  return useQuery({
    queryKey: ["landing-timeline", days],
    queryFn: () => api<{ points: TimelinePoint[] }>(`/api/landing/timeline?days=${days}`).then((r) => r.points),
    staleTime: 5 * 60_000,
    retry,
  });
}
