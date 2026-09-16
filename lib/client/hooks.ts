"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { creatorKey } from "../creators";
import type { BoardSummary, CreatorProfile, CreatorRef, FavoriteCreator, FavoriteCreatorWithStats, Post } from "../types";
import { api } from "./api";
import { useSession } from "./session";

export function usePost(id: string, initialData?: Post) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: ["post", id],
    queryFn: () => api<Post>(`/api/posts/${id}`),
    initialData: () => initialData ?? queryClient.getQueryData<Post>(["post", id]),
    staleTime: 5 * 60_000,
  });
}

export function useSimilarPosts(id: string) {
  return useQuery({
    queryKey: ["similar", id],
    queryFn: () => api<{ items: Post[] }>(`/api/posts/${id}/similar`).then((r) => r.items),
    staleTime: 5 * 60_000,
  });
}

export function useSavedMap() {
  const { user } = useSession();
  return useQuery({
    queryKey: ["saved", user?.id ?? "anon"],
    queryFn: () => api<{ saved: Record<string, string[]> }>("/api/boards/saved").then((r) => r.saved),
    enabled: Boolean(user),
    staleTime: 30_000,
  });
}

export function useBoards() {
  const { user } = useSession();
  return useQuery({
    queryKey: ["boards", user?.id],
    queryFn: () => api<{ items: BoardSummary[] }>("/api/boards").then((r) => r.items),
    enabled: Boolean(user),
  });
}

/** Save / unsave / create-and-save mutations shared by the card and detail views. */
export function useBoardMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["saved"] });
    queryClient.invalidateQueries({ queryKey: ["boards"] });
    queryClient.invalidateQueries({ queryKey: ["board"] });
  };

  const save = useMutation({
    mutationFn: ({ boardId, postId }: { boardId: string; postId: string }) =>
      api(`/api/boards/${boardId}/posts`, { method: "POST", json: { postId } }),
    onSettled: invalidate,
  });
  const unsave = useMutation({
    mutationFn: ({ boardId, postId }: { boardId: string; postId: string }) =>
      api(`/api/boards/${boardId}/posts/${postId}`, { method: "DELETE" }),
    onSettled: invalidate,
  });
  const create = useMutation({
    mutationFn: ({ name, postId }: { name: string; postId?: string }) =>
      api<BoardSummary>("/api/boards", { method: "POST", json: { name, postId } }),
    onSettled: invalidate,
  });
  return { save, unsave, create };
}

export function useFavoriteCreators() {
  const { user } = useSession();
  return useQuery({
    queryKey: ["creators", user?.id],
    queryFn: () => api<{ items: FavoriteCreatorWithStats[] }>("/api/creators").then((r) => r.items),
    enabled: Boolean(user),
    staleTime: 30_000,
  });
}

/** Favorite lookup by creator key, for toggle buttons. */
export function useFavoriteCreatorMap() {
  const { data } = useFavoriteCreators();
  return new Map((data ?? []).map((creator) => [creatorKey(creator), creator]));
}

export function useCreatorProfile(ref: CreatorRef) {
  const { user } = useSession();
  return useQuery({
    queryKey: ["creator-profile", user?.id ?? "anon", creatorKey(ref)],
    queryFn: () => api<CreatorProfile>(`/api/creators/profile?platform=${ref.platform}&handle=${encodeURIComponent(ref.handle)}`),
  });
}

export type CreatorFetchResult = { status: "fetched" | "cached"; postsFound: number; source: "apify" | "demo" };

export function useCreatorMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["creators"] });
    queryClient.invalidateQueries({ queryKey: ["creator-profile"] });
  };

  const add = useMutation({
    mutationFn: (data: CreatorRef & { name?: string; avatarUrl?: string | null }) =>
      api<FavoriteCreator>("/api/creators", { method: "POST", json: data }),
    onSettled: invalidate,
  });
  const remove = useMutation({
    mutationFn: (id: string) => api(`/api/creators/${id}`, { method: "DELETE" }),
    onSettled: invalidate,
  });
  const fetchPosts = useMutation({
    mutationFn: (data: CreatorRef & { name?: string; avatarUrl?: string | null; force?: boolean }) =>
      api<CreatorFetchResult>("/api/creators/fetch", { method: "POST", json: data }),
    onSuccess: (result) => {
      if (result.postsFound > 0) {
        queryClient.invalidateQueries({ queryKey: ["posts"] });
        queryClient.invalidateQueries({ queryKey: ["creator-posts"] });
        queryClient.invalidateQueries({ queryKey: ["timeline"] });
      }
      invalidate();
    },
  });
  return { add, remove, fetchPosts };
}
