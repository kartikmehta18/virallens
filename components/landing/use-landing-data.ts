"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/client/api";
import type { PostPage, TimelinePoint } from "@/lib/types";

/** Live data behind the landing page visuals (falls back gracefully while loading). */
export function useTrendingPosts(limit: number, mediaType?: string) {
  const params = new URLSearchParams({ sort: "trending", limit: String(limit) });
  if (mediaType) params.set("mediaType", mediaType);
  return useQuery({
    queryKey: ["landing-posts", params.toString()],
    queryFn: () => api<PostPage>(`/api/posts?${params}`),
    staleTime: 5 * 60_000,
  });
}

export function useTimeline(days: number) {
  return useQuery({
    queryKey: ["landing-timeline", days],
    queryFn: () => api<{ points: TimelinePoint[] }>(`/api/posts/timeline?days=${days}`).then((r) => r.points),
    staleTime: 5 * 60_000,
  });
}
