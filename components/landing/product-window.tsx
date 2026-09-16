"use client";

import {
  ArrowDownRight,
  ArrowUpRight,
  Bell,
  Bookmark,
  Compass,
  Flame,
  LayoutGrid,
  Layers,
  Search,
  Settings,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, Line, ResponsiveContainer, Tooltip, XAxis, type TooltipContentProps } from "recharts";
import { LogoMark } from "@/components/ui/primitives";
import { PLATFORM_LABELS } from "@/lib/client/filters";
import { formatCount, timeAgo } from "@/lib/client/format";
import type { Platform, TimelinePoint } from "@/lib/types";
import { useTimeline, useTrendingPosts } from "./use-landing-data";

const RANGES = [
  { label: "7d", days: 7 },
  { label: "14d", days: 14 },
  { label: "30d", days: 30 },
];

const dayLabel = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en", { month: "short", day: "numeric", timeZone: "UTC" });

/** macOS-style window showing a live miniature of the ViralLens workspace. */
export function ProductWindow() {
  const [range, setRange] = useState(30);
  const { data: timeline } = useTimeline(range);
  const { data: trending } = useTrendingPosts(4);

  const chart = useMemo(() => {
    const points = timeline ?? [];
    // 3-day moving average drawn dashed on the same axis (no second scale).
    return points.map((p, i) => {
      const window = points.slice(Math.max(0, i - 2), i + 1);
      return { ...p, average: Math.round(window.reduce((s, w) => s + w.engagement, 0) / window.length) };
    });
  }, [timeline]);

  const totals = useMemo(() => {
    const points = timeline ?? [];
    const half = Math.floor(points.length / 2);
    const sum = (arr: TimelinePoint[], key: "engagement" | "posts") => arr.reduce((s, p) => s + p[key], 0);
    const recent = points.slice(half);
    const prior = points.slice(0, half);
    const change = (key: "engagement" | "posts") => {
      const before = sum(prior, key);
      return before ? ((sum(recent, key) - before) / before) * 100 : 0;
    };
    const platformCounts = (trending?.items ?? []).reduce<Record<string, number>>(
      (acc, p) => ({ ...acc, [p.platform]: (acc[p.platform] ?? 0) + 1 }),
      {},
    );
    const topPlatform = (Object.entries(platformCounts).sort((a, b) => b[1] - a[1])[0]?.[0] as Platform | undefined) ?? "instagram";
    const peak = Math.max(0, ...(trending?.items ?? []).map((p) => p.trendingScore));
    return {
      engagement: sum(points, "engagement"),
      posts: trending?.total ?? sum(points, "posts"),
      engagementChange: change("engagement"),
      postsChange: change("posts"),
      topPlatform,
      peak,
    };
  }, [timeline, trending]);

  const stats = [
    { label: "Posts Tracked", value: formatCount(totals.posts), delta: totals.postsChange, icon: Layers },
    { label: "Total Engagement", value: formatCount(totals.engagement), delta: totals.engagementChange, icon: Flame },
    { label: "Top Platform", value: PLATFORM_LABELS[totals.topPlatform], delta: null, icon: LayoutGrid },
    { label: "Peak Trending", value: formatCount(totals.peak), delta: null, icon: TrendingUp },
  ];

  return (
    <div className="border-border bg-surface overflow-hidden rounded-xl border [mask-image:linear-gradient(to_bottom,black_78%,transparent)] shadow-[0_40px_120px_-40px_rgba(0,0,0,0.9)]">
      <div className="border-border relative flex h-9 items-center border-b px-4">
        <div className="flex gap-2">
          <span className="size-3 rounded-full bg-[#ff5f57]" />
          <span className="size-3 rounded-full bg-[#febc2e]" />
          <span className="size-3 rounded-full bg-[#28c840]" />
        </div>
        <span className="text-muted absolute inset-x-0 text-center text-xs">ViralLens</span>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] md:grid-cols-[210px_minmax(0,1fr)]">
        <aside className="border-border hidden flex-col border-r md:flex">
          <div className="border-border flex h-14 items-center gap-2 border-b px-4 text-sm font-semibold">
            <LogoMark className="size-5" />
            ViralLens
          </div>
          <p className="text-muted px-4 pt-4 pb-2 text-[10px] font-medium tracking-[0.12em]">WORKSPACE</p>
          <nav className="space-y-0.5 px-2">
            {[
              { icon: LayoutGrid, label: "Overview", active: true },
              { icon: Compass, label: "Explore" },
              { icon: Bookmark, label: "Boards" },
              { icon: Bell, label: "Alerts" },
              { icon: Settings, label: "Settings" },
            ].map(({ icon: Icon, label, active }) => (
              <span
                key={label}
                className={`flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] ${active ? "bg-surface-2 text-foreground font-medium" : "text-muted"}`}
              >
                <Icon className="size-4" /> {label}
              </span>
            ))}
          </nav>
          <div className="mt-auto p-3">
            <div className="border-border flex items-center gap-2 rounded-md border px-3 py-2.5">
              <span className="pulse-dot bg-foreground size-1.5 rounded-full" />
              <span>
                <span className="block text-[11px] font-medium">Sources connected</span>
                <span className="text-muted block text-[10px]">Updated just now</span>
              </span>
            </div>
          </div>
        </aside>

        <div className="min-w-0">
          <div className="border-border flex h-14 items-center gap-3 border-b px-3 sm:px-5">
            <div>
              <p className="text-[13px] leading-tight font-semibold">Virality Overview</p>
              <p className="text-muted text-[11px]">Last {range} days · All platforms</p>
            </div>
            <div className="border-border text-muted ml-auto hidden h-8 w-44 items-center gap-2 rounded-md border px-2.5 text-[12px] sm:flex">
              <Search className="size-3.5" /> Search <kbd className="ml-auto font-sans text-[10px]">⌘K</kbd>
            </div>
            <span className="border-border text-muted grid size-8 place-items-center rounded-md border">
              <Bell className="size-3.5" />
            </span>
            <span className="bg-foreground text-background grid size-8 place-items-center rounded-full text-[11px] font-semibold">VL</span>
          </div>

          <div className="grid grid-cols-2 gap-2 p-3 sm:gap-3 sm:p-4 lg:grid-cols-4 [&>*]:min-w-0">
            {stats.map(({ label, value, delta, icon: Icon }) => (
              <div key={label} className="border-border rounded-lg border p-3">
                <div className="text-muted flex items-center justify-between text-[11px]">
                  {label} <Icon className="size-3.5" />
                </div>
                <div className="mt-2 flex items-end justify-between">
                  <span className="truncate text-base font-semibold tabular-nums sm:text-lg">{value}</span>
                  {delta !== null && (
                    <span className="text-muted flex items-center gap-0.5 text-[10px]">
                      {delta >= 0 ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
                      {Math.abs(delta).toFixed(1)}%
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-[minmax(0,1fr)] gap-3 px-3 pb-3 sm:px-4 sm:pb-4 lg:grid-cols-[minmax(0,1fr)_300px]">
            <div className="border-border rounded-lg border p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[13px] font-semibold">Engagement Activity</p>
                  <p className="text-muted text-[11px]">Daily engagement vs. 3-day average</p>
                </div>
                <div className="border-border flex rounded-md border p-0.5">
                  {RANGES.map((r) => (
                    <button
                      key={r.days}
                      onClick={() => setRange(r.days)}
                      className={`rounded px-2 py-0.5 text-[11px] ${range === r.days ? "bg-surface-2 text-foreground font-medium" : "text-muted"}`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="text-muted mt-3 flex gap-4 text-[11px]">
                <span className="flex items-center gap-1.5">
                  <span className="bg-foreground size-1.5 rounded-full" /> Engagement
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="border-muted h-px w-3 border-t border-dashed" /> 3-day average
                </span>
              </div>
              <div className="mt-2 h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chart} margin={{ top: 10, right: 4, left: 4, bottom: 0 }}>
                    <defs>
                      <linearGradient id="windowFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--foreground)" stopOpacity={0.16} />
                        <stop offset="100%" stopColor="var(--foreground)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={dayLabel}
                      tick={{ fill: "var(--muted)", fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                      minTickGap={40}
                    />
                    <Tooltip content={WindowTooltip} cursor={{ stroke: "var(--border)" }} />
                    <Area
                      type="monotone"
                      dataKey="engagement"
                      stroke="var(--foreground)"
                      strokeWidth={2}
                      fill="url(#windowFill)"
                      isAnimationActive
                      animationDuration={1200}
                    />
                    <Line
                      type="monotone"
                      dataKey="average"
                      stroke="var(--muted)"
                      strokeWidth={1.25}
                      strokeDasharray="4 4"
                      dot={false}
                      isAnimationActive
                      animationDuration={1400}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="border-border rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <p className="text-[13px] font-semibold">Trending Now</p>
                <Link href="/explore" className="text-muted hover:text-foreground flex items-center gap-0.5 text-[11px]">
                  View all <ArrowUpRight className="size-3" />
                </Link>
              </div>
              <ul className="divide-border mt-3 divide-y">
                {(trending?.items ?? []).slice(0, 4).map((post) => (
                  <li key={post.id} className="flex items-start gap-2.5 py-2.5">
                    <span className="bg-foreground mt-1.5 size-1.5 shrink-0 rounded-full" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12px] font-medium">{post.caption.split("\n")[0]}</span>
                      <span className="text-muted block truncate text-[10.5px]">
                        {post.authorName} · ♥ {formatCount(post.likeCount)} · {timeAgo(post.publishedAt)}
                      </span>
                    </span>
                    <span className="border-border text-muted shrink-0 rounded border px-1.5 py-0.5 text-[10px]">
                      {PLATFORM_LABELS[post.platform]}
                    </span>
                  </li>
                ))}
                {!trending && Array.from({ length: 4 }, (_, i) => <li key={i} className="skeleton my-2 h-9 rounded" />)}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function WindowTooltip({ active, payload }: TooltipContentProps) {
  const point = payload?.[0]?.payload as (TimelinePoint & { average: number }) | undefined;
  if (!active || !point) return null;
  return (
    <div className="border-border bg-surface rounded-md border px-2.5 py-1.5 text-[11px] shadow-xl">
      <p className="font-medium">{dayLabel(point.date)}</p>
      <p className="text-muted">
        Engagement <span className="text-foreground font-semibold">{point.engagement.toLocaleString()}</span>
      </p>
      <p className="text-muted">
        3-day avg <span className="text-foreground font-semibold">{point.average.toLocaleString()}</span>
      </p>
      <p className="text-muted">
        Posts <span className="text-foreground font-semibold">{point.posts}</span>
      </p>
    </div>
  );
}
