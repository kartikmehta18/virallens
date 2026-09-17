"use client";

import { Check, Database, FlaskConical, Monitor, Moon, RotateCcw, Sparkles, Sun, Webhook } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { PlatformIcon } from "@/components/icons/platform-icon";
import { segmentClass } from "@/components/ui/form";
import { Crosshairs } from "@/components/ui/primitives";
import { PLATFORM_LABELS, RANGE_LABELS, SORT_LABELS } from "@/lib/client/filters";
import { DEFAULT_PREFERENCES, usePreferences, type Preferences } from "@/lib/client/preferences";
import { useSession } from "@/lib/client/session";
import { DATE_RANGES, PLATFORMS, SORTS } from "@/lib/types";

export default function SettingsPage() {
  const [prefs, update] = usePreferences();
  const { session, user } = useSession();

  return (
    <div className="mx-auto max-w-[1040px] px-5 py-12 sm:px-8">
      <h1 className="display text-[36px] sm:text-[44px]">
        <b>Settings</b>
      </h1>
      <p className="text-muted mt-3 max-w-xl text-[15px]">
        Tune the search experience, appearance and defaults. Preferences are saved in this browser.
      </p>

      <div className="mt-10 space-y-6">
        <Section title="Search bar" description="Where the search composer lives on the Explore page.">
          <div className="grid gap-4 sm:grid-cols-2">
            <LayoutOption
              active={prefs.searchPosition === "bottom"}
              onClick={() => update({ searchPosition: "bottom" })}
              title="Docked composer"
              body="A glass, chat-style box pinned to the bottom of the screen."
              preview={
                <div className="relative h-full">
                  <div className="grid grid-cols-4 gap-1 p-2 opacity-60">
                    {Array.from({ length: 8 }, (_, i) => (
                      <div key={i} className={`bg-surface-2 rounded-sm ${i % 3 === 0 ? "row-span-2 h-12" : "h-5"}`} />
                    ))}
                  </div>
                  <div className="border-foreground/15 bg-foreground/[0.06] absolute inset-x-6 bottom-2 h-7 rounded-lg border backdrop-blur" />
                </div>
              }
            />
            <LayoutOption
              active={prefs.searchPosition === "top"}
              onClick={() => update({ searchPosition: "top" })}
              title="Top search bar"
              body="The composer sits inline above the results and scrolls with the page."
              preview={
                <div className="h-full p-2">
                  <div className="border-foreground/15 bg-foreground/[0.06] h-7 rounded-lg border" />
                  <div className="mt-2 grid grid-cols-4 gap-1 opacity-60">
                    {Array.from({ length: 8 }, (_, i) => (
                      <div key={i} className={`bg-surface-2 rounded-sm ${i % 3 === 0 ? "row-span-2 h-10" : "h-4"}`} />
                    ))}
                  </div>
                </div>
              }
            />
          </div>
        </Section>

        <Section title="Appearance" description="Theme and how densely the bento grid packs posts.">
          <Row label="Theme">
            <Segmented<Preferences["theme"]>
              value={prefs.theme}
              onChange={(theme) => update({ theme })}
              options={[
                { value: "dark", label: "Dark", icon: <Moon className="size-3.5" /> },
                { value: "light", label: "Light", icon: <Sun className="size-3.5" /> },
                { value: "system", label: "System", icon: <Monitor className="size-3.5" /> },
              ]}
            />
          </Row>
          <Row label="Grid density">
            <Segmented<Preferences["density"]>
              value={prefs.density}
              onChange={(density) => update({ density })}
              options={[
                { value: "comfortable", label: "Comfortable" },
                { value: "compact", label: "Compact" },
              ]}
            />
          </Row>
          <Row label="Trend chart" hint="Show the 30-day engagement chart above results.">
            <Toggle checked={prefs.showTrendChart} onChange={(showTrendChart) => update({ showTrendChart })} />
          </Row>
        </Section>

        <Section title="Explore defaults" description="Applied whenever a filter isn't set in the URL.">
          <Row label="Default sort">
            <Segmented
              value={prefs.defaultSort}
              onChange={(defaultSort) => update({ defaultSort })}
              options={SORTS.map((s) => ({ value: s, label: SORT_LABELS[s] }))}
            />
          </Row>
          <Row label="Default date range">
            <Segmented
              value={prefs.defaultDateRange}
              onChange={(defaultDateRange) => update({ defaultDateRange })}
              options={DATE_RANGES.filter((r) => r !== "custom").map((r) => ({ value: r, label: RANGE_LABELS[r] }))}
            />
          </Row>
          <Row label="Default platforms" hint="None selected means all platforms.">
            <div className="flex flex-wrap gap-2">
              {PLATFORMS.map((platform) => {
                const active = prefs.defaultPlatforms.includes(platform);
                return (
                  <button
                    key={platform}
                    onClick={() =>
                      update({
                        defaultPlatforms: active
                          ? prefs.defaultPlatforms.filter((p) => p !== platform)
                          : [...prefs.defaultPlatforms, platform],
                      })
                    }
                    className={`flex h-9 items-center gap-2 rounded-md border px-3 text-[13px] transition ${active ? "border-foreground/40 bg-surface-2 text-foreground" : "border-border text-muted hover:text-foreground"}`}
                  >
                    <PlatformIcon platform={platform} className="size-3.5" />
                    {PLATFORM_LABELS[platform]}
                    {active && <Check className="text-accent size-3.5" />}
                  </button>
                );
              })}
            </div>
          </Row>
          <Row label="Fetch fresh posts on search" hint="Run the Apify scrapers (or demo generator) every time you search a topic.">
            <Toggle checked={prefs.autoFetch} onChange={(autoFetch) => update({ autoFetch })} />
          </Row>
        </Section>

        <Section title="Workspace" description="How this deployment is configured (set in .env).">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 [&>*]:min-w-0">
            <Status
              icon={<FlaskConical className="size-4" />}
              label="Test mode"
              value={session ? (session.testMode ? "On — local accounts" : "Off — server accounts") : "…"}
              on={session?.testMode}
            />
            <Status
              icon={<Database className="size-4" />}
              label="Database"
              value={session ? (session.dbEnabled ? "MySQL connected" : "In-memory store") : "…"}
              on={session?.dbEnabled}
            />
            <Status
              icon={<Webhook className="size-4" />}
              label="Apify"
              value={session ? (session.apifyEnabled ? "Live scraping" : "Demo data") : "…"}
              on={session?.apifyEnabled}
            />
            <Status
              icon={<Sparkles className="size-4" />}
              label="AI breakdowns"
              value={
                session
                  ? { anthropic: "Claude", openai: "OpenAI", gemini: "Gemini", heuristic: "Built-in analysis" }[session.aiProvider]
                  : "…"
              }
              on={session ? session.aiProvider !== "heuristic" : undefined}
            />
            <div className="border-border rounded-md border p-4 sm:col-span-2 lg:col-span-2">
              <p className="text-[13px] font-medium">Account</p>
              {user ? (
                <div className="text-muted mt-1 text-[13px]">
                  <p className="truncate">
                    @{user.username ?? user.name} · {user.email}
                  </p>
                  <p className="mt-0.5 font-mono text-xs break-all">{user.id}</p>
                </div>
              ) : (
                <p className="text-muted mt-1 text-[13px]">
                  Not signed in.{" "}
                  <Link href="/login?next=/settings" className="text-foreground underline-offset-4 hover:underline">
                    Sign in
                  </Link>
                </p>
              )}
            </div>
          </div>
        </Section>

        <div className="flex justify-end">
          <button onClick={() => update({ ...DEFAULT_PREFERENCES })} className="btn-secondary">
            <RotateCcw className="size-4" /> Reset to defaults
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <section className="border-border bg-surface relative border">
      <Crosshairs />
      <header className="border-border border-b px-4 py-4 sm:px-6 sm:py-5">
        <h2 className="text-[15px] font-semibold">{title}</h2>
        <p className="text-muted mt-1 text-[13px]">{description}</p>
      </header>
      <div className="divide-border divide-y [&>*]:px-4 [&>*]:py-4 sm:[&>*]:px-6 sm:[&>*]:py-5">{children}</div>
    </section>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-[14px] font-medium">{label}</p>
        {hint && <p className="text-muted mt-0.5 text-[12.5px]">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; icon?: ReactNode }[];
}) {
  return (
    <div className="border-border flex flex-wrap rounded-md border p-1">
      {options.map((option) => (
        <button key={option.value} onClick={() => onChange(option.value)} className={segmentClass(value === option.value)}>
          {option.icon}
          {option.label}
        </button>
      ))}
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full border transition ${checked ? "border-accent bg-accent" : "border-border bg-surface-2"}`}
    >
      <span
        className={`absolute top-0.5 size-[18px] rounded-full bg-white shadow transition-all ${checked ? "left-[22px]" : "left-0.5"}`}
      />
    </button>
  );
}

function LayoutOption({
  active,
  onClick,
  title,
  body,
  preview,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  body: string;
  preview: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`group relative border p-4 text-left transition ${active ? "border-accent" : "border-border hover:border-foreground/25"}`}
    >
      <div className="border-border bg-background h-28 overflow-hidden border">{preview}</div>
      <div className="mt-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-[14px] font-medium">{title}</p>
          <p className="text-muted mt-1 text-[12.5px] leading-relaxed">{body}</p>
        </div>
        <span
          className={`grid size-5 shrink-0 place-items-center rounded-full border ${active ? "border-accent bg-accent text-white" : "border-border"}`}
        >
          {active && <Check className="size-3" />}
        </span>
      </div>
    </button>
  );
}

function Status({ icon, label, value, on }: { icon: ReactNode; label: string; value: string; on?: boolean }) {
  return (
    <div className="border-border rounded-md border p-4">
      <p className="flex items-center gap-2 text-[13px] font-medium">
        <span className={on ? "text-accent" : "text-muted"}>{icon}</span>
        {label}
      </p>
      <p className="text-muted mt-1 text-[13px]">{value}</p>
    </div>
  );
}
