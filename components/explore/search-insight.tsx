"use client";

import { useQuery } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { api } from "@/lib/client/api";
import type { QueryInsight } from "@/lib/types";

const chipClass =
  "border-foreground/10 bg-foreground/[0.04] hover:bg-foreground/[0.09] text-foreground rounded-full border px-3 py-1 text-xs transition";

/**
 * "Did you mean devops?" and related searches for the current topic, from Gemini (GET
 * /api/search/understand — cached per query server-side, so revisiting a topic costs nothing).
 * Renders nothing when there's no suggestion or no AI key.
 */
export function SearchInsight({ topic, onSearch }: { topic: string; onSearch: (topic: string) => void }) {
  const { data } = useQuery({
    queryKey: ["understand", topic.toLowerCase()],
    queryFn: () => api<QueryInsight>(`/api/search/understand?q=${encodeURIComponent(topic)}`),
    enabled: topic.trim().length >= 2,
    staleTime: Infinity,
  });
  if (!data || (!data.corrected && !data.related.length)) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
      {data.corrected && (
        <p>
          Did you mean{" "}
          <button type="button" onClick={() => onSearch(data.corrected!)} className="text-accent font-semibold hover:underline">
            {data.corrected}
          </button>
          ?
        </p>
      )}
      {data.related.length > 0 && (
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <span className="text-muted flex items-center gap-1 text-xs">
            <Sparkles className="size-3.5" /> Related:
          </span>
          {data.related.map((related) => (
            <button key={related} type="button" onClick={() => onSearch(related)} className={chipClass}>
              {related}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Shorter searches offered when a long query finds nothing (from lib/search.ts suggestions()). */
export function SuggestionChips({ items, onSearch }: { items: string[]; onSearch: (topic: string) => void }) {
  if (!items.length) return null;
  return (
    <div className="mt-4 flex flex-wrap justify-center gap-1.5">
      {items.map((item) => (
        <button key={item} type="button" onClick={() => onSearch(item)} className={chipClass}>
          {item}
        </button>
      ))}
    </div>
  );
}
