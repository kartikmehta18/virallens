"use client";

import { ArrowUp, AtSign, Calendar, Download, Film, Flame, Layers, Loader2, RefreshCw, Settings2, Users, X } from "lucide-react";
import Link from "next/link";
import { useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { PlatformIcon } from "@/components/icons/platform-icon";
import { Avatar } from "@/components/post/avatar";
import { useFavoriteCreators } from "@/lib/client/hooks";
import { useSession } from "@/lib/client/session";
import { creatorKey, parseCreatorKey } from "@/lib/creators";
import { MEDIA_LABELS, PLATFORM_LABELS, RANGE_LABELS, SORT_LABELS, filtersToParams, type ExploreFilters } from "@/lib/client/filters";
import { DATE_RANGES, MEDIA_TYPES, PLATFORMS, SORTS } from "@/lib/types";
import { PillMenu } from "./pill-menu";
import { WatchButton } from "./watch-button";

interface Props {
  filters: ExploreFilters;
  onChange: (patch: Partial<ExploreFilters>) => void;
  onSearch: (topic: string) => void;
  onRefresh: () => void;
  scraping: boolean;
  docked: boolean;
}

const toggle = <T,>(list: T[], value: T) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

const SUGGESTIONS = ["AI tools", "personal branding", "fitness", "startups", "productivity"];

/** Chat-style glass composer holding the search query and every filter. Docks to the bottom of the screen or sits inline. */
export function SearchComposer({ filters, onChange, onSearch, onRefresh, scraping, docked }: Props) {
  const [draft, setDraft] = useState(filters.topic);
  const [syncedTopic, setSyncedTopic] = useState(filters.topic);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const { user } = useSession();
  const { data: favorites = [] } = useFavoriteCreators();
  const favoriteByKey = new Map(favorites.map((c) => [creatorKey(c), c]));
  const allFavoriteKeys = favorites.map(creatorKey);
  const allFavoritesApplied = allFavoriteKeys.length > 0 && allFavoriteKeys.every((k) => filters.creators.includes(k));
  const direction = docked ? "up" : "down";

  // Keep the box in sync when the topic changes elsewhere (hashtag click, back button).
  if (filters.topic !== syncedTopic) {
    setSyncedTopic(filters.topic);
    setDraft(filters.topic);
  }

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    onSearch(draft.trim().replace(/\s+/g, " "));
    textarea.current?.blur();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  };

  const platformLabel =
    filters.platforms.length === 0
      ? "All platforms"
      : filters.platforms.length === 1
        ? PLATFORM_LABELS[filters.platforms[0]]
        : `${filters.platforms.length} platforms`;
  const formatLabel = filters.mediaTypes.length === 0 ? "Any format" : filters.mediaTypes.map((m) => MEDIA_LABELS[m]).join(", ");
  const canSend = draft.trim().length >= 2 || (draft.trim() === "" && filters.topic !== "");

  const panel = (
    <form
      onSubmit={submit}
      className="group/composer relative isolate w-full rounded-[18px] border border-white/[0.09] bg-[color-mix(in_oklab,var(--surface)_62%,transparent)] shadow-[0_30px_80px_-24px_rgba(0,0,0,0.85),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-2xl backdrop-saturate-150 transition focus-within:border-white/[0.16] sm:rounded-[22px]"
    >
      {/* soft aurora glow, like the reference composer */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-[18px] sm:rounded-[22px]">
        <div className="bg-accent/22 group-focus-within/composer:bg-accent/32 absolute -right-12 -bottom-20 h-44 w-80 rounded-full blur-3xl transition duration-500" />
        <div className="absolute right-40 -bottom-24 h-32 w-56 rounded-full bg-[#7c3aed]/14 blur-3xl" />
        <div className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
      </div>

      <div className="flex items-center gap-2 px-3 pt-2.5 sm:px-4 sm:pt-3">
        <PillMenu
          direction={direction}
          label={<span className="sr-only">Platforms</span>}
          icon={<AtSign className="size-3.5" />}
          active={filters.platforms.length > 0}
          options={PLATFORMS.map((p) => ({
            value: p,
            label: PLATFORM_LABELS[p],
            icon: <PlatformIcon platform={p} className="size-3.5" />,
          }))}
          selected={filters.platforms}
          onSelect={(p) => onChange({ platforms: toggle(filters.platforms, p) })}
          footer={
            filters.platforms.length > 0 && (
              <button
                type="button"
                onClick={() => onChange({ platforms: [] })}
                className="text-muted hover:bg-foreground/[0.07] mt-1 w-full rounded-xl px-2.5 py-2 text-left text-xs"
              >
                Clear — search all platforms
              </button>
            )
          }
        />
        <PillMenu
          direction={direction}
          label={filters.creators.length ? `${filters.creators.length}` : "Creators"}
          compact={filters.creators.length ? undefined : "sm"}
          icon={<Users className="size-3.5" />}
          active={filters.creators.length > 0}
          options={favorites.map((c) => ({
            value: creatorKey(c),
            label: c.name,
            icon: <Avatar src={c.avatarUrl} name={c.name} className="size-4 text-[8px]" />,
          }))}
          selected={filters.creators}
          onSelect={(key) => onChange({ creators: toggle(filters.creators, key) })}
          header={
            <div className="border-foreground/10 mb-1 border-b px-2.5 pt-1.5 pb-2">
              <p className="text-foreground text-xs font-medium">Favorite creators</p>
              {!user ? (
                <p className="text-muted mt-1 text-[11px]">
                  <Link href="/login?next=/explore" className="text-foreground underline underline-offset-2">
                    Sign in
                  </Link>{" "}
                  to filter by the creators you save.
                </p>
              ) : favorites.length === 0 ? (
                <p className="text-muted mt-1 text-[11px]">Save creators from any post to filter by them here.</p>
              ) : (
                <button
                  type="button"
                  onClick={() => onChange({ creators: allFavoritesApplied ? [] : allFavoriteKeys })}
                  className="text-accent mt-1 text-[11px] font-medium hover:underline"
                >
                  {allFavoritesApplied ? "Clear all" : `Apply all ${favorites.length} favorites`}
                </button>
              )}
            </div>
          }
          footer={
            <Link
              href="/creators"
              className="text-muted hover:bg-foreground/[0.07] hover:text-foreground border-foreground/10 mt-1 block w-full rounded-xl border-t px-2.5 py-2 text-left text-xs"
            >
              Manage creators →
            </Link>
          }
        />
        <div className="no-scrollbar flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto">
          {filters.creators.map((key) => {
            const creator = favoriteByKey.get(key);
            const ref = creator ?? parseCreatorKey(key);
            if (!ref) return null;
            return (
              <span
                key={key}
                className="border-accent/30 bg-accent/12 text-foreground flex h-7 shrink-0 items-center gap-1.5 rounded-full border pr-1 pl-1 text-xs font-medium"
              >
                <Avatar src={creator?.avatarUrl ?? null} name={creator?.name ?? ref.handle} className="size-5 text-[9px]" />@{ref.handle}
                <button
                  type="button"
                  onClick={() => onChange({ creators: filters.creators.filter((k) => k !== key) })}
                  className="hover:bg-foreground/10 grid size-5 place-items-center rounded-full"
                  aria-label={`Remove @${ref.handle} filter`}
                >
                  <X className="size-3" />
                </button>
              </span>
            );
          })}
          {filters.topic && (
            <span className="border-accent/30 bg-accent/12 text-foreground flex h-7 shrink-0 items-center gap-1 rounded-full border pr-1 pl-2.5 text-xs font-medium">
              {filters.topic}
              <button
                type="button"
                onClick={() => onSearch("")}
                className="hover:bg-foreground/10 grid size-5 place-items-center rounded-full"
                aria-label="Clear topic"
              >
                <X className="size-3" />
              </button>
            </span>
          )}
          {filters.platforms.map((p) => (
            <span
              key={p}
              className="bg-foreground/[0.06] text-foreground/80 flex h-7 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-xs"
            >
              <PlatformIcon platform={p} className="size-3" /> {PLATFORM_LABELS[p]}
            </span>
          ))}
          {!filters.topic &&
            filters.platforms.length === 0 &&
            filters.creators.length === 0 &&
            SUGGESTIONS.map((s) => (
              <button
                type="button"
                key={s}
                onClick={() => {
                  setDraft(s);
                  onSearch(s);
                }}
                className="text-muted hover:bg-foreground/[0.06] hover:text-foreground h-7 shrink-0 rounded-full px-2.5 text-xs transition"
              >
                {s}
              </button>
            ))}
        </div>
      </div>

      <textarea
        ref={textarea}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        rows={1}
        placeholder="Search a viral topic or #hashtag"
        aria-label="Search topic"
        className="text-foreground placeholder:text-muted/70 block field-sizing-content max-h-32 min-h-11 w-full resize-none bg-transparent px-4 py-2 text-base leading-relaxed outline-none sm:px-5 sm:py-2.5 sm:text-[15px]"
      />

      <div className="flex items-center gap-1.5 px-2.5 pb-2.5 sm:gap-2 sm:px-3 sm:pb-3">
        {/* no overflow here: the pill menus are absolutely positioned and would be clipped */}
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
          <PillMenu
            direction={direction}
            label={
              filters.sort.length === 1
                ? SORT_LABELS[filters.sort[0]]
                : filters.sort.length === 2
                  ? filters.sort.map((s) => SORT_LABELS[s]).join(" + ")
                  : `${SORT_LABELS[filters.sort[0]]} +${filters.sort.length - 1}`
            }
            active={filters.sort.length > 1}
            compact="xs"
            icon={<Flame className="size-3.5" />}
            options={SORTS.map((s) => ({ value: s, label: SORT_LABELS[s] }))}
            selected={filters.sort}
            // Multi-select: toggling keeps at least one sort selected.
            onSelect={(sort) => {
              const next = toggle(filters.sort, sort);
              if (next.length) onChange({ sort: next });
            }}
            header={<p className="text-muted px-2.5 pt-1.5 pb-1 text-[11px]">Pick one or more — several blend their rankings</p>}
            footer={
              filters.sort.length > 1 && (
                <button
                  type="button"
                  onClick={() => onChange({ sort: [filters.sort[0]] })}
                  className="text-muted hover:bg-foreground/[0.07] border-foreground/10 mt-1 w-full rounded-xl border-t px-2.5 py-2 text-left text-xs"
                >
                  Keep only {SORT_LABELS[filters.sort[0]]}
                </button>
              )
            }
          />
          <PillMenu
            direction={direction}
            label={
              filters.dateRange === "custom" && (filters.from || filters.to)
                ? `${filters.from || "…"} → ${filters.to || "…"}`
                : RANGE_LABELS[filters.dateRange]
            }
            icon={<Calendar className="size-3.5" />}
            compact="sm"
            active={filters.dateRange !== "all"}
            options={DATE_RANGES.map((r) => ({ value: r, label: RANGE_LABELS[r] }))}
            selected={[filters.dateRange]}
            onSelect={(dateRange) => onChange({ dateRange })}
            footer={
              filters.dateRange === "custom" && (
                <div className="border-foreground/10 mt-1 grid gap-1.5 border-t p-2 text-xs">
                  <label className="text-muted flex items-center justify-between gap-2">
                    From
                    <input
                      type="date"
                      value={filters.from}
                      onChange={(e) => onChange({ from: e.target.value })}
                      className="bg-foreground/[0.06] text-foreground rounded-lg px-2 py-1 text-base sm:text-xs"
                    />
                  </label>
                  <label className="text-muted flex items-center justify-between gap-2">
                    To
                    <input
                      type="date"
                      value={filters.to}
                      onChange={(e) => onChange({ to: e.target.value })}
                      className="bg-foreground/[0.06] text-foreground rounded-lg px-2 py-1 text-base sm:text-xs"
                    />
                  </label>
                </div>
              )
            }
          />
          <PillMenu
            direction={direction}
            label={formatLabel}
            compact="sm"
            icon={filters.mediaTypes.includes("video") ? <Film className="size-3.5" /> : <Layers className="size-3.5" />}
            active={filters.mediaTypes.length > 0}
            options={MEDIA_TYPES.map((m) => ({ value: m, label: MEDIA_LABELS[m] }))}
            selected={filters.mediaTypes}
            onSelect={(m) => onChange({ mediaTypes: toggle(filters.mediaTypes, m) })}
          />
          <span className="text-muted hidden text-[11px] sm:inline">· {platformLabel}</span>
        </div>

        <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
          {filters.topic && <WatchButton topic={filters.topic} platforms={filters.platforms} />}
          {filters.topic && (
            <IconButton onClick={onRefresh} disabled={scraping} label="Fetch fresh posts">
              <RefreshCw className={`size-4 ${scraping ? "animate-spin" : ""}`} />
            </IconButton>
          )}
          <a
            href={`/api/posts/export?${filtersToParams(filters)}`}
            title="Export results as CSV"
            aria-label="Export CSV"
            className={iconButtonClass}
          >
            <Download className="size-4" />
          </a>
          <Link href="/settings" title="Search settings" aria-label="Search settings" className={`${iconButtonClass} hidden sm:grid`}>
            <Settings2 className="size-4" />
          </Link>
          <button
            type="submit"
            disabled={!canSend || scraping}
            aria-label="Search"
            className={`ml-0.5 grid size-9 place-items-center rounded-full transition sm:ml-1 ${
              canSend
                ? "bg-foreground text-background shadow-lg shadow-black/40 hover:opacity-90 active:scale-95"
                : "bg-foreground/10 text-muted"
            }`}
          >
            {scraping ? <Loader2 className="size-4 animate-spin" /> : <ArrowUp className="size-4" />}
          </button>
        </div>
      </div>
    </form>
  );

  if (!docked) return panel;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6 sm:pb-5">
      <div
        aria-hidden
        className="from-background via-background/70 absolute inset-x-0 bottom-0 -z-10 h-28 bg-gradient-to-t to-transparent"
      />
      <div className="pointer-events-auto mx-auto max-w-3xl">{panel}</div>
    </div>
  );
}

const iconButtonClass =
  "grid size-8 place-items-center rounded-full text-muted transition hover:bg-foreground/[0.08] hover:text-foreground disabled:opacity-40";

function IconButton({ children, label, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button type="button" title={label} aria-label={label} className={iconButtonClass} {...rest}>
      {children}
    </button>
  );
}
