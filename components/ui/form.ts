/** Shared form control styles for the premium dark theme. */
export const inputClass =
  "h-11 w-full rounded-md border border-border bg-background px-3.5 text-base text-foreground sm:text-sm outline-none transition placeholder:text-muted/70 hover:border-foreground/20 focus:border-foreground/40 focus:ring-4 focus:ring-foreground/5";

export const segmentClass = (active: boolean) =>
  `flex items-center justify-center gap-2 rounded px-3.5 py-1.5 text-[13px] font-medium transition ${active ? "bg-surface-2 text-foreground shadow-[inset_0_0_0_1px_var(--border)]" : "text-muted hover:text-foreground"}`;
