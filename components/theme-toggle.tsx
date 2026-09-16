"use client";

import { Moon, Sun } from "lucide-react";
import { writePreferences } from "@/lib/client/preferences";

export function ThemeToggle() {
  const toggle = () => writePreferences({ theme: document.documentElement.classList.contains("dark") ? "light" : "dark" });

  return (
    <button
      onClick={toggle}
      className="text-muted hover:bg-surface-2 hover:text-foreground grid size-9 place-items-center rounded-full transition"
      aria-label="Toggle dark mode"
    >
      <Sun className="size-4 dark:hidden" />
      <Moon className="hidden size-4 dark:block" />
    </button>
  );
}
