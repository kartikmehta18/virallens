"use client";

import { Loader2, UserCheck, UserPlus } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { creatorKey } from "@/lib/creators";
import { useCreatorMutations, useFavoriteCreatorMap } from "@/lib/client/hooks";
import { useSession } from "@/lib/client/session";
import type { CreatorRef } from "@/lib/types";

interface Props {
  creator: CreatorRef & { name: string; avatarUrl: string | null };
  /** "icon": round icon button; "pill": icon + label. */
  variant?: "icon" | "pill";
  className?: string;
}

/** Toggles a creator in the user's favorites. Signed-out users are sent to sign in first. */
export function SaveCreatorButton({ creator, variant = "pill", className = "" }: Props) {
  const { user } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const favorites = useFavoriteCreatorMap();
  const { add, remove } = useCreatorMutations();
  const saved = favorites.get(creatorKey(creator));
  const busy = add.isPending || remove.isPending;

  const toggle = () => {
    if (!user) {
      router.push(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }
    if (saved) remove.mutate(saved.id);
    else add.mutate({ platform: creator.platform, handle: creator.handle, name: creator.name, avatarUrl: creator.avatarUrl });
  };

  const label = saved ? "Saved creator" : "Save creator";
  const Icon = busy ? Loader2 : saved ? UserCheck : UserPlus;

  if (variant === "icon") {
    return (
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        title={saved ? "Remove from favorite creators" : "Save to favorite creators"}
        aria-label={label}
        aria-pressed={Boolean(saved)}
        className={`grid size-8 shrink-0 place-items-center rounded-full border transition disabled:opacity-60 ${
          saved ? "border-accent/50 bg-accent/15 text-accent" : "border-border text-muted hover:border-foreground/30 hover:text-foreground"
        } ${className}`}
      >
        <Icon className={`size-4 ${busy ? "animate-spin" : ""}`} />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-pressed={Boolean(saved)}
      className={`${saved ? "btn-secondary border-accent/50 text-accent" : "btn-secondary"} h-9 ${className}`}
    >
      <Icon className={`size-4 ${busy ? "animate-spin" : ""}`} />
      {label}
    </button>
  );
}
