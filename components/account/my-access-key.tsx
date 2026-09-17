"use client";

import { useQuery } from "@tanstack/react-query";
import { KeyRound } from "lucide-react";
import { api } from "@/lib/client/api";
import { ago } from "@/lib/client/format";
import { useSession } from "@/lib/client/session";
import { SecretField } from "./access-key-field";

type AccessKeyResponse = { accessKey: string | null; hasAccessKey: boolean; createdAt: string | null };

/** The signed-in user's own access key (server accounts). Renders nothing in TEST_MODE. */
export function MyAccessKey({ compact = false }: { compact?: boolean }) {
  const { session, user } = useSession();
  const enabled = Boolean(user && session && !session.testMode);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["access-key", user?.id],
    queryFn: () => api<AccessKeyResponse>("/api/auth/access-key"),
    enabled,
  });
  if (!enabled) return null;

  const hint = isError
    ? "Couldn't load your access key."
    : !data?.hasAccessKey
      ? "No access key yet — ask an admin to generate one."
      : !data.accessKey
        ? "Your key can't be displayed (the server secret changed). Ask an admin to regenerate it."
        : `Sign in with this key on any device${data.createdAt ? ` · created ${ago(data.createdAt)}` : ""}. Keep it private.`;

  return (
    <div className={compact ? "" : "border-border rounded-md border p-4"}>
      <p className="flex items-center gap-2 text-[13px] font-medium">
        <KeyRound className="text-accent size-4" /> Your access key
      </p>
      <SecretField className="mt-2" value={data?.accessKey ?? null} placeholder={isLoading ? "Loading…" : "Not available"} />
      <p className="text-muted mt-2 text-[12px] leading-relaxed">{isLoading ? " " : hint}</p>
    </div>
  );
}
