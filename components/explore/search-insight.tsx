"use client";

import { useQuery } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { api } from "@/lib/client/api";
import type { QueryInsight } from "@/lib/types";

const chipClass =
  "border-foreground/10 bg-foreground/[0.04] hover:bg-foreground/[0.09] text-foreground rounded-full border px-3 py-1 text-xs transition";

const toggleClass = "text-muted hover:text-foreground text-xs underline-offset-2 hover:underline";

/** Spelling fix + related searches for a topic (GET /api/search/understand — cached per query server-side). */
export function useQueryInsight(topic: string) {
  return useQuery({
    queryKey: ["understand", topic.toLowerCase()],
    queryFn: () => api<QueryInsight>(`/api/search/understand?q=${encodeURIComponent(topic)}`),
    enabled: topic.trim().length >= 2,
    staleTime: Infinity,
  });
}

/**
 * "Did you mean devops?" and related searches for the current topic, from Gemini — revisiting a topic costs
 * nothing. A topic's first fetch searches the spelling fix and every related search on the sources, and the
 * feed shows their posts after the topic's own, one section per chip; a chip searches just that one, and
 * "Exact matches only" drops them. Renders nothing when there's no suggestion or no AI key.
 */
export function SearchInsight({
  topic,
  exact,
  onSearch,
  onExactChange,
}: {
  topic: string;
  exact: boolean;
  onSearch: (topic: string) => void;
  onExactChange: (exact: boolean) => void;
}) {
  const { data } = useQueryInsight(topic);
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
            <Sparkles className="size-3.5" /> {exact ? "Related:" : "Also showing:"}
          </span>
          {data.related.map((related) => (
            <button
              key={related}
              type="button"
              onClick={() => onSearch(related)}
              title={`Search only “${related}”`}
              className={`${chipClass} ${exact ? "opacity-60" : ""}`}
            >
              {related}
            </button>
          ))}
          <button type="button" onClick={() => onExactChange(!exact)} className={toggleClass}>
            {exact ? "Include related posts" : "Exact matches only"}
          </button>
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
