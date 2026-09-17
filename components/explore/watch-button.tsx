"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, BellRing } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { api } from "@/lib/client/api";
import { useSession } from "@/lib/client/session";
import type { Platform, WatchedTopic } from "@/lib/types";

/** Toggles an alert watch for the current topic (spec Phase 8). */
export function WatchButton({ topic, platforms }: { topic: string; platforms: Platform[] }) {
  const { user } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();

  const { data: watches } = useQuery({
    queryKey: ["watches", user?.id],
    queryFn: () => api<{ items: WatchedTopic[] }>("/api/watches").then((r) => r.items),
    enabled: Boolean(user),
  });
  const existing = watches?.find((w) => w.topic.toLowerCase() === topic.toLowerCase());

  const mutation = useMutation({
    mutationFn: () =>
      existing
        ? api(`/api/watches/${existing.id}`, { method: "DELETE" })
        : api("/api/watches", { method: "POST", json: { topic, platforms, thresholdScore: 50 } }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["watches"] }),
  });

  return (
    <button
      type="button"
      disabled={mutation.isPending}
      onClick={() => (user ? mutation.mutate() : router.push(`/login?next=${encodeURIComponent(pathname)}`))}
      className={`hover:bg-foreground/8 grid size-8 place-items-center rounded-full transition ${existing ? "text-accent" : "text-muted hover:text-foreground"}`}
      title={
        existing
          ? "Watching — you'll be alerted when a post crosses the threshold. Click to stop."
          : "Watch topic: get alerts when posts go viral"
      }
      aria-label={existing ? "Stop watching topic" : "Watch topic"}
    >
      {existing ? <BellRing className="size-4" /> : <Bell className="size-4" />}
    </button>
  );
}
