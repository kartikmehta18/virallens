"use client";

import { Check, ChevronDown } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";

export interface PillOption<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
}

interface Props<T extends string> {
  label: ReactNode;
  icon?: ReactNode;
  options: PillOption<T>[];
  selected: T[];
  onSelect: (value: T) => void;
  /** Open the menu upward (composer docked at the bottom) or downward. */
  direction?: "up" | "down";
  active?: boolean;
  footer?: ReactNode;
  header?: ReactNode;
  /** Hide the text label below this breakpoint so the pill collapses to its icon on phones. */
  compact?: "sm" | "xs";
}

/** Small glass pill that opens a floating option menu — the "Agent ▾ / Auto ▾" controls of the composer. */
export function PillMenu<T extends string>({
  label,
  icon,
  options,
  selected,
  onSelect,
  direction = "up",
  active,
  footer,
  header,
  compact,
}: Props<T>) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  return (
    <div ref={root} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={typeof label === "string" ? label : undefined}
        className={`flex h-8 items-center gap-1.5 rounded-full border px-2.5 text-[13px] transition sm:px-3 ${
          active
            ? "border-accent/40 bg-accent/15 text-foreground"
            : "border-foreground/10 bg-foreground/[0.06] text-foreground/80 hover:bg-foreground/10 hover:text-foreground"
        }`}
      >
        {icon}
        <span className={compact === "sm" ? "hidden sm:inline" : compact === "xs" ? "hidden min-[400px]:inline" : undefined}>{label}</span>
        <ChevronDown
          className={`size-3.5 opacity-60 transition ${open ? "rotate-180" : ""} ${compact === "sm" ? "hidden sm:block" : compact === "xs" ? "hidden min-[400px]:block" : ""}`}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: direction === "up" ? 6 : -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: direction === "up" ? 6 : -6, scale: 0.97 }}
            transition={{ duration: 0.14 }}
            className={`absolute left-0 z-50 max-h-[min(60vh,420px)] max-w-[calc(100vw-2rem)] min-w-48 overflow-y-auto overscroll-contain rounded-xl border border-white/[0.09] bg-[color-mix(in_oklab,var(--surface)_94%,transparent)] p-1.5 shadow-2xl backdrop-blur-2xl ${
              direction === "up" ? "bottom-full mb-2 origin-bottom-left" : "top-full mt-2 origin-top-left"
            }`}
          >
            {header}
            {options.map((option) => {
              const isSelected = selected.includes(option.value);
              return (
                <button
                  type="button"
                  key={option.value}
                  onClick={() => onSelect(option.value)}
                  className="hover:bg-foreground/[0.07] flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm"
                >
                  <span className="text-muted grid size-4 place-items-center">{option.icon}</span>
                  <span className="min-w-0 flex-1 truncate whitespace-nowrap">{option.label}</span>
                  {isSelected && <Check className="text-accent size-4" />}
                </button>
              );
            })}
            {footer}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
