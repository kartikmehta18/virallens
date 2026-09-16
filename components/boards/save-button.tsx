"use client";

import { Bookmark, Check, Loader2, Plus } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { useBoardMutations, useBoards, useSavedMap } from "@/lib/client/hooks";
import { useSession } from "@/lib/client/session";

interface Props {
  postId: string;
  variant?: "overlay" | "solid";
  className?: string;
}

/** Bookmark button that opens a board picker popover (rendered in a portal so card overflow doesn't clip it). */
export function SaveButton({ postId, variant = "overlay", className = "" }: Props) {
  const { user } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [picker, setPicker] = useState<{ anchor: HTMLElement; top: number; left: number } | null>(null);
  const { data: saved } = useSavedMap();
  const isSaved = Boolean(saved?.[postId]?.length);

  const onClick = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (!user) {
      router.push(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }
    if (picker) return setPicker(null);
    const anchor = event.currentTarget as HTMLElement;
    const rect = anchor.getBoundingClientRect();
    const width = 260;
    setPicker({
      anchor,
      top: Math.min(rect.bottom + 8, window.innerHeight - 340),
      left: Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8)),
    });
  };

  const base =
    variant === "overlay" ? "size-9 rounded-full bg-black/45 text-white backdrop-blur-md hover:bg-black/65" : "btn-secondary h-9 gap-2";

  return (
    <>
      <button
        onClick={onClick}
        className={`grid grid-flow-col place-items-center transition ${base} ${className}`}
        aria-label={isSaved ? "Saved — manage boards" : "Save to board"}
      >
        <Bookmark className={`size-4 ${isSaved ? "fill-current" : ""}`} />
        {variant === "solid" && <span>{isSaved ? "Saved" : "Save"}</span>}
      </button>
      <AnimatePresence>{picker && <BoardPicker {...picker} postId={postId} onClose={() => setPicker(null)} />}</AnimatePresence>
    </>
  );
}

interface PickerProps {
  anchor: HTMLElement;
  top: number;
  left: number;
  postId: string;
  onClose: () => void;
}

function BoardPicker({ anchor, top, left, postId, onClose }: PickerProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [name, setName] = useState("");
  const { data: boards, isLoading } = useBoards();
  const { data: saved } = useSavedMap();
  const { save, unsave, create } = useBoardMutations();
  const savedIn = new Set(saved?.[postId] ?? []);

  useEffect(() => {
    const onPointer = (e: PointerEvent) => {
      if (!panelRef.current?.contains(e.target as Node) && !anchor.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey, true);
    window.addEventListener("resize", onClose);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey, true);
      window.removeEventListener("resize", onClose);
    };
  }, [anchor, onClose]);

  const onCreate = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    create.mutate({ name: name.trim(), postId }, { onSuccess: () => setName("") });
  };

  return createPortal(
    <motion.div
      ref={panelRef}
      initial={{ opacity: 0, y: -6, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -6, scale: 0.97 }}
      transition={{ duration: 0.15 }}
      style={{ top, left }}
      className="border-border bg-surface text-foreground fixed z-[100] w-[260px] rounded-lg border p-2 shadow-2xl"
      onClick={(e) => e.stopPropagation()}
    >
      <p className="text-muted px-2 pt-1 pb-1 text-xs font-medium tracking-wide uppercase">Save to board</p>
      <div className="no-scrollbar max-h-52 overflow-y-auto">
        {isLoading && <Loader2 className="text-muted mx-auto my-3 size-4 animate-spin" />}
        {boards?.length === 0 && <p className="text-muted px-2 py-2 text-sm">No boards yet — create one below.</p>}
        {boards?.map((board) => {
          const active = savedIn.has(board.id);
          return (
            <button
              key={board.id}
              onClick={() => (active ? unsave : save).mutate({ boardId: board.id, postId })}
              className="hover:bg-surface-2 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm"
            >
              <span
                className={`grid size-5 place-items-center rounded-md border ${active ? "border-accent bg-accent text-white" : "border-border"}`}
              >
                {active && <Check className="size-3.5" />}
              </span>
              <span className="flex-1 truncate">{board.name}</span>
              <span className="text-muted text-xs">{board.postCount}</span>
            </button>
          );
        })}
      </div>
      <form onSubmit={onCreate} className="border-border mt-1 flex items-center gap-1 border-t pt-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New board name"
          className="border-border bg-background focus:border-foreground/40 h-8 min-w-0 flex-1 rounded-md border px-2 text-base outline-none sm:text-sm"
        />
        <button
          type="submit"
          disabled={!name.trim() || create.isPending}
          className="bg-foreground text-background grid size-8 place-items-center rounded-md disabled:opacity-40"
          aria-label="Create board"
        >
          {create.isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
        </button>
      </form>
    </motion.div>,
    document.body,
  );
}
