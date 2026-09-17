"use client";

import { Bookmark, Loader2, Plus } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { RequireUser } from "@/components/auth/require-user";
import { inputClass } from "@/components/ui/form";
import { Crosshairs } from "@/components/ui/primitives";
import { mediaSrc } from "@/lib/client/format";
import { useBoardMutations, useBoards } from "@/lib/client/hooks";

export default function BoardsPage() {
  return (
    <RequireUser title="boards">
      <BoardsList />
    </RequireUser>
  );
}

function BoardsList() {
  const { data: boards, isLoading } = useBoards();
  const { create } = useBoardMutations();
  const [name, setName] = useState("");

  const onCreate = (e: FormEvent) => {
    e.preventDefault();
    if (name.trim()) create.mutate({ name: name.trim() }, { onSuccess: () => setName("") });
  };

  return (
    <div className="mx-auto max-w-[1440px] px-5 py-12 sm:px-8 lg:px-10">
      <div className="flex flex-wrap items-end gap-6">
        <div>
          <h1 className="display text-[36px] sm:text-[44px]">
            Your <b>boards</b>
          </h1>
          <p className="text-muted mt-3 text-[15px]">Swipe files of posts you&apos;re studying and want to remix.</p>
        </div>
        <form onSubmit={onCreate} className="flex w-full gap-2 lg:ml-auto lg:w-auto">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="New board name"
            className={`${inputClass} h-10 min-w-0 flex-1 lg:w-64 lg:flex-none`}
          />
          <button disabled={!name.trim() || create.isPending} className="btn-primary shrink-0">
            {create.isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} Create
          </button>
        </form>
      </div>

      {isLoading ? (
        <div className="mt-10 grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="skeleton aspect-square rounded-lg" />
          ))}
        </div>
      ) : !boards?.length ? (
        <div className="border-border relative mt-10 flex flex-col items-center border px-6 py-20 text-center">
          <Crosshairs />
          <Bookmark className="text-muted size-7" />
          <p className="mt-4 font-medium">No boards yet</p>
          <p className="text-muted mt-1 text-sm">Create one above, or hit the bookmark on any post while exploring.</p>
          <Link href="/explore" className="btn-secondary mt-6">
            Go to Explore
          </Link>
        </div>
      ) : (
        <div className="mt-10 grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
          {boards.map((board, i) => (
            <motion.div key={board.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
              <Link href={`/boards/${board.id}`} className="group block">
                <div className="border-border bg-border group-hover:border-foreground/30 grid aspect-square grid-cols-2 grid-rows-2 gap-px overflow-hidden rounded-lg border transition">
                  {board.covers.length === 0 && (
                    <div className="bg-surface col-span-2 row-span-2 grid place-items-center">
                      <Bookmark className="text-muted size-6" />
                    </div>
                  )}
                  {board.covers.length > 0 &&
                    [0, 1, 2, 3].map((slot) =>
                      board.covers[slot] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          key={slot}
                          src={mediaSrc(board.covers[slot])}
                          alt=""
                          referrerPolicy="no-referrer"
                          className={`h-full w-full object-cover transition duration-500 group-hover:scale-[1.03] ${board.covers.length === 1 ? "col-span-2 row-span-2" : ""}`}
                        />
                      ) : (
                        board.covers.length !== 1 && <div key={slot} className="bg-surface" />
                      ),
                    )}
                </div>
                <p className="mt-3 truncate text-[15px] font-medium">{board.name}</p>
                <p className="text-muted text-[13px]">
                  {board.postCount} post{board.postCount === 1 ? "" : "s"}
                </p>
              </Link>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
