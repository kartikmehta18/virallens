"use client";

import { useQuery } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipContentProps } from "recharts";
import { api } from "@/lib/client/api";
import { Crosshairs } from "@/components/ui/primitives";
import { filtersToParams, type ExploreFilters } from "@/lib/client/filters";
import { formatCount } from "@/lib/client/format";
import type { TimelinePoint } from "@/lib/types";

// Hourly buckets are "YYYY-MM-DDTHH", daily ones "YYYY-MM-DD" (both UTC).
const pointDate = (key: string) => new Date(key.length > 10 ? `${key}:00:00Z` : `${key}T00:00:00Z`);
const dayLabel = (key: string) =>
  key.length > 10
    ? pointDate(key).toLocaleTimeString("en", { hour: "numeric" })
    : pointDate(key).toLocaleDateString("en", { month: "short", day: "numeric", timeZone: "UTC" });

function windowLabel(filters: ExploreFilters) {
  switch (filters.dateRange) {
    case "24h":
      return "the last 24 hours";
    case "7d":
      return "the last 7 days";
    case "custom":
      return filters.from || filters.to ? `${filters.from || "…"} → ${filters.to || "…"}` : "the last 30 days";
    default:
      return "the last 30 days";
  }
}

/**
 * Engagement volume for the applied filters (single series, single axis; post count lives in the tooltip).
 * Uses the same date range, platforms, formats and creators as the grid, so the counts agree.
 */
export function TrendChart({ filters }: { filters: ExploreFilters }) {
  const [open, setOpen] = useState(true);
  const params = filtersToParams({ ...filters, sort: ["trending"] });
  params.set("days", "30");

  const { data, isLoading } = useQuery({
    queryKey: ["timeline", params.toString()],
    queryFn: () => api<{ points: TimelinePoint[] }>(`/api/posts/timeline?${params}`).then((r) => r.points),
    placeholderData: (previous) => previous,
  });
  const topic = filters.topic;

  const totals = (data ?? []).reduce((acc, p) => ({ posts: acc.posts + p.posts, engagement: acc.engagement + p.engagement }), {
    posts: 0,
    engagement: 0,
  });
  const peak = (data ?? []).reduce<TimelinePoint | null>((best, p) => (!best || p.engagement > best.engagement ? p : best), null);

  return (
    <section className="border-border bg-surface relative border">
      <Crosshairs />
      <button onClick={() => setOpen((o) => !o)} className="flex w-full flex-wrap items-center gap-x-5 gap-y-1 px-4 py-3 text-left">
        <h2 className="text-sm font-semibold">Engagement over {windowLabel(filters)}{topic ? ` · “${topic}”` : ""}</h2>
        <span className="text-muted text-xs">
          <strong className="text-foreground font-semibold">{formatCount(totals.engagement)}</strong> engagement ·{" "}
          <strong className="text-foreground font-semibold">{formatCount(totals.posts)}</strong> posts
          {peak && peak.engagement > 0 && <> · peak {dayLabel(peak.date)}</>}
          {filters.dateRange === "all" && <> · grid shows all time</>}
        </span>
        <ChevronDown className={`text-muted ml-auto size-4 transition ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="h-40 px-2 pb-3">
          {isLoading ? (
            <div className="skeleton h-full rounded-md" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-series)" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="var(--chart-series)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
                <XAxis
                  dataKey="date"
                  tickFormatter={dayLabel}
                  tick={{ fill: "var(--muted)", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  minTickGap={28}
                />
                <YAxis
                  tickFormatter={(v: number) => formatCount(v)}
                  tick={{ fill: "var(--muted)", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={44}
                />
                <Tooltip content={ChartTooltip} cursor={{ stroke: "var(--muted)", strokeWidth: 1, strokeDasharray: "3 3" }} />
                <Area
                  type="monotone"
                  dataKey="engagement"
                  stroke="var(--chart-series)"
                  strokeWidth={2}
                  fill="url(#trendFill)"
                  activeDot={{ r: 5, stroke: "var(--surface)", strokeWidth: 2, fill: "var(--chart-series)" }}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      )}
    </section>
  );
}

function ChartTooltip({ active, payload }: TooltipContentProps) {
  const point = payload?.[0]?.payload as TimelinePoint | undefined;
  if (!active || !point) return null;
  return (
    <div className="border-border bg-surface rounded-xl border px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-medium">
        {point.date.length > 10 ? `${pointDate(point.date).toLocaleDateString("en", { month: "short", day: "numeric" })}, ` : ""}
        {dayLabel(point.date)}
      </p>
      <p className="text-muted flex items-center gap-2">
        <span className="size-2 rounded-full bg-[var(--chart-series)]" />
        Engagement <span className="text-foreground ml-auto pl-3 font-semibold tabular-nums">{point.engagement.toLocaleString()}</span>
      </p>
      <p className="text-muted mt-0.5 flex items-center gap-2 pl-4">
        Posts <span className="text-foreground ml-auto pl-3 font-semibold tabular-nums">{point.posts}</span>
      </p>
    </div>
  );
}
