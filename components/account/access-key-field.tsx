"use client";

import { Check, Copy, Eye, EyeOff } from "lucide-react";
import { useState } from "react";

const mask = (value: string) => {
  // 6-digit access keys: showing any digit would give part of the key away.
  if (/^\d{6}$/.test(value)) return "••••••";
  const inviteAt = value.indexOf("invite=");
  const head = inviteAt > -1 ? value.slice(0, inviteAt + 7) : value.slice(0, 5);
  return `${head}${"•".repeat(12)}${value.slice(-4)}`;
};

/** Monospace secret with reveal and copy controls. */
export function SecretField({
  value,
  placeholder = "—",
  defaultRevealed = false,
  label = "access key",
  className = "",
}: {
  value: string | null;
  placeholder?: string;
  defaultRevealed?: boolean;
  label?: string;
  className?: string;
}) {
  const [revealed, setRevealed] = useState(defaultRevealed);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // Clipboard API unavailable (http / old browser): select the text instead.
      const range = document.createRange();
      const node = document.getElementById(`secret-${value.slice(-8)}`);
      if (node) {
        range.selectNodeContents(node);
        window.getSelection()?.removeAllRanges();
        window.getSelection()?.addRange(range);
      }
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className={`border-border bg-background flex h-10 min-w-0 items-center gap-1 rounded-md border pr-1 pl-3 ${className}`}>
      <code
        id={value ? `secret-${value.slice(-8)}` : undefined}
        className={`min-w-0 flex-1 truncate font-mono text-[12.5px] ${value ? "text-foreground" : "text-muted"}`}
        title={value && revealed ? value : undefined}
      >
        {value ? (revealed ? value : mask(value)) : placeholder}
      </code>
      {value && (
        <>
          <button
            type="button"
            onClick={() => setRevealed((r) => !r)}
            aria-label={revealed ? `Hide ${label}` : `Show ${label}`}
            title={revealed ? "Hide" : "Show"}
            className="text-muted hover:text-foreground hover:bg-surface-2 grid size-8 shrink-0 place-items-center rounded transition"
          >
            {revealed ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
          <button
            type="button"
            onClick={copy}
            aria-label={`Copy ${label}`}
            title="Copy"
            className="text-muted hover:text-foreground hover:bg-surface-2 grid size-8 shrink-0 place-items-center rounded transition"
          >
            {copied ? <Check className="text-accent size-4" /> : <Copy className="size-4" />}
          </button>
        </>
      )}
    </div>
  );
}
