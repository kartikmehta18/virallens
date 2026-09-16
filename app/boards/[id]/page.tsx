"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { RequireUser } from "@/components/auth/require-user";
import { BentoGrid, GridSkeleton } from "@/components/grid/bento-grid";
import { inputClass } from "@/components/ui/form";
import { Crosshairs } from "@/components/ui/primitives";
import { usePreferences } from "@/lib/client/preferences";
import { api } from "@/lib/client/api";
import { useSession } from "@/lib/client/session";
import type { BoardDetail } from "@/lib/types";

export default function BoardPage() {
  return (
    <RequireUser title="board">
      <BoardView />
    </RequireUser>
  );
}

function BoardView() {
  const { id } = useParams<{ id: string }>();
  const { user } = useSession();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<string | null>(null);
  const [prefs] = usePreferences();

  const {
    data: board,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["board", user?.id, id],
    queryFn: () => api<BoardDetail>(`/api/boards/${id}`),
  });

  const rename = useMutation({
    mutationFn: (name: string) => api(`/api/boards/${id}`, { method: "PATCH", json: { name } }),
    onSuccess: () => {
      setEditing(null);
      queryClient.invalidateQueries({ queryKey: ["board"] });
      queryClient.invalidateQueries({ queryKey: ["boards"] });
    },
  });

  const remove = useMutation({
    mutationFn: () => api(`/api/boards/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["boards"] });
      queryClient.invalidateQueries({ queryKey: ["saved"] });
      router.push("/boards");
    },
  });

  if (isError) {
    return (
      <div className="mx-auto max-w-md px-6 py-24 text-center">
        <p className="font-medium">Board not found.</p>
        <Link href="/boards" className="text-accent mt-4 inline-block text-sm">
          Back to boards
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1600px] px-5 py-10 sm:px-8 lg:px-10">
      <Link href="/boards" className="text-muted hover:text-foreground inline-flex items-center gap-1.5 text-sm">
        <ArrowLeft className="size-4" /> All boards
      </Link>

      <div className="mt-5 mb-8 flex flex-wrap items-center gap-4">
        {editing !== null ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (editing.trim()) rename.mutate(editing.trim());
            }}
            className="flex w-full max-w-md items-center gap-2"
          >
            <input
              autoFocus
              value={editing}
              onChange={(e) => setEditing(e.target.value)}
              className={`${inputClass} h-11 min-w-0 flex-1 text-lg font-medium`}
            />
            <button className="btn-primary size-11 px-0" aria-label="Save name">
              <Check className="size-4" />
            </button>
          </form>
        ) : (
          <h1 className="display max-w-full min-w-0 text-[30px] font-semibold break-words sm:text-[44px]">{board?.name ?? "…"}</h1>
        )}
        {board && <span className="text-muted text-sm">{board.postCount} saved</span>}
        {board && editing === null && (
          <div className="flex gap-2 sm:ml-auto">
            <button onClick={() => setEditing(board.name)} className="btn-secondary h-9">
              <Pencil className="size-3.5" /> Rename
            </button>
            <button
              onClick={() => confirm(`Delete board “${board.name}”? Saved posts stay available in Explore.`) && remove.mutate()}
              className="btn-secondary h-9 text-red-400"
            >
              <Trash2 className="size-3.5" /> Delete
            </button>
          </div>
        )}
      </div>

      {isLoading ? (
        <GridSkeleton count={10} />
      ) : board?.posts.length ? (
        <BentoGrid posts={board.posts} layoutScope="board" density={prefs.density} />
      ) : (
        <div className="border-border text-muted relative border px-6 py-20 text-center text-sm">
          <Crosshairs />
          Nothing saved here yet. Use the bookmark button on any post to add it.
        </div>
      )}
    </div>
  );
}
