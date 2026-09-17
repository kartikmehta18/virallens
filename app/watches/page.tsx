"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BellRing, Loader2, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { RequireUser } from "@/components/auth/require-user";
import { inputClass } from "@/components/ui/form";
import { Crosshairs } from "@/components/ui/primitives";
import { PlatformIcon } from "@/components/icons/platform-icon";
import { api } from "@/lib/client/api";
import { PLATFORM_LABELS } from "@/lib/client/filters";
import { timeAgo } from "@/lib/client/format";
import { useSession } from "@/lib/client/session";
import { PLATFORMS, type Platform, type WatchedTopic } from "@/lib/types";

export default function WatchesPage() {
  return (
    <RequireUser title="alerts">
      <Watches />
    </RequireUser>
  );
}

function Watches() {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const [topic, setTopic] = useState("");
  const [threshold, setThreshold] = useState(50);
  const [platforms, setPlatforms] = useState<Platform[]>([...PLATFORMS]);

  const { data: watches, isLoading } = useQuery({
    queryKey: ["watches", user?.id],
    queryFn: () => api<{ items: WatchedTopic[] }>("/api/watches").then((r) => r.items),
  });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["watches"] });

  const create = useMutation({
    mutationFn: () => api("/api/watches", { method: "POST", json: { topic, platforms, thresholdScore: threshold } }),
    onSuccess: () => {
      setTopic("");
      invalidate();
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => api(`/api/watches/${id}`, { method: "DELETE" }),
    onSettled: invalidate,
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (topic.trim().length >= 2 && platforms.length) create.mutate();
  };

  return (
    <div className="mx-auto max-w-[1040px] px-5 py-12 sm:px-8">
      <h1 className="display text-[36px] sm:text-[44px]">
        Topic <b>alerts</b>
      </h1>
      <p className="text-muted mt-3 max-w-2xl text-[15px] leading-relaxed">
        Watched topics are re-scraped on a schedule. When a new post&apos;s trending score crosses your threshold you get an email
        {user?.isTest ? " (test accounts: alerts are logged on the server instead)" : ""}.
      </p>

      <form onSubmit={onSubmit} className="border-border bg-surface relative mt-8 space-y-5 border p-4 sm:mt-10 sm:p-6">
        <Crosshairs />
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Topic to watch, e.g. “AI agents”"
            className={`${inputClass} sm:flex-1`}
          />
          <label className="text-muted flex shrink-0 items-center gap-2 text-sm">
            Threshold
            <input
              type="number"
              min={1}
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
              className={`${inputClass} w-24!`}
            />
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {PLATFORMS.map((p) => {
            const active = platforms.includes(p);
            return (
              <button
                type="button"
                key={p}
                onClick={() => setPlatforms(active ? platforms.filter((x) => x !== p) : [...platforms, p])}
                className={`flex h-9 items-center gap-2 rounded-md border px-3 text-[13px] transition ${active ? "border-foreground/40 bg-surface-2 text-foreground" : "border-border text-muted hover:text-foreground"}`}
              >
                <PlatformIcon platform={p} className="size-3.5" /> {PLATFORM_LABELS[p]}
              </button>
            );
          })}
          <button
            disabled={create.isPending || topic.trim().length < 2 || !platforms.length}
            className="btn-primary w-full sm:ml-auto sm:w-auto"
          >
            {create.isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} Watch topic
          </button>
        </div>
        {create.isError && <p className="text-sm text-red-500">{create.error.message}</p>}
        <p className="text-muted text-xs">
          Trending score = engagement ÷ (hours since posted + 2)^1.5. A score of 50 is a strong early signal.
        </p>
      </form>

      <div className="divide-border border-border mt-8 divide-y border-y">
        {isLoading && <div className="skeleton my-3 h-14 rounded-md" />}
        {watches?.length === 0 && <p className="text-muted py-8 text-center text-sm">No watched topics yet.</p>}
        {watches?.map((watch) => (
          <div key={watch.id} className="flex items-center gap-4 px-1 py-4">
            <BellRing className="text-accent size-4" />
            <div className="min-w-0 flex-1">
              <Link href={`/explore?topic=${encodeURIComponent(watch.topic)}`} className="font-medium hover:underline">
                {watch.topic}
              </Link>
              <p className="text-muted text-xs">
                {watch.platforms.map((p) => PLATFORM_LABELS[p]).join(", ")} · threshold {watch.thresholdScore} ·{" "}
                {watch.lastCheckedAt ? `checked ${timeAgo(watch.lastCheckedAt)} ago` : "not checked yet"}
              </p>
            </div>
            <button
              onClick={() => remove.mutate(watch.id)}
              className="text-muted grid size-9 place-items-center rounded-md transition hover:bg-red-500/10 hover:text-red-400"
              aria-label="Remove watch"
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
