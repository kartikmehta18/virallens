"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { DateRange, Platform, SortKey } from "../types";

export interface Preferences {
  /** Where the search composer lives: docked at the bottom (chat style) or inline at the top. */
  searchPosition: "bottom" | "top";
  theme: "system" | "light" | "dark";
  density: "comfortable" | "compact";
  /** Fetch fresh posts from the sources whenever you search. */
  autoFetch: boolean;
  showTrendChart: boolean;
  defaultSort: SortKey;
  defaultDateRange: DateRange;
  defaultPlatforms: Platform[];
}

export const DEFAULT_PREFERENCES: Preferences = {
  searchPosition: "bottom",
  theme: "dark",
  density: "comfortable",
  autoFetch: true,
  showTrendChart: true,
  defaultSort: "trending",
  defaultDateRange: "all",
  defaultPlatforms: [],
};

const KEY = "virallens:prefs";
const listeners = new Set<() => void>();
let cache: { raw: string | null; value: Preferences } = { raw: null, value: DEFAULT_PREFERENCES };

export function readPreferences(): Preferences {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {}
  if (raw !== cache.raw) {
    try {
      cache = { raw, value: raw ? { ...DEFAULT_PREFERENCES, ...JSON.parse(raw) } : DEFAULT_PREFERENCES };
    } catch {
      cache = { raw, value: DEFAULT_PREFERENCES };
    }
  }
  return cache.value;
}

export function applyTheme(theme: Preferences["theme"]) {
  const dark = theme === "dark" || (theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => e.key === KEY && listener();
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function writePreferences(patch: Partial<Preferences>) {
  const next = { ...readPreferences(), ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {}
  if (patch.theme) applyTheme(patch.theme);
  listeners.forEach((l) => l());
}

export function usePreferences(): [Preferences, (patch: Partial<Preferences>) => void] {
  const prefs = useSyncExternalStore(subscribe, readPreferences, () => DEFAULT_PREFERENCES);
  const update = useCallback((patch: Partial<Preferences>) => writePreferences(patch), []);
  return [prefs, update];
}
