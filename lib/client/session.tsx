"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import type { SessionInfo, User } from "../types";
import { api } from "./api";
import { loginLocalAccount, logoutLocalAccount, registerLocalAccount } from "./local-accounts";

/** Test-mode local account (stored in this browser). Server accounts sign up with Google instead. */
export interface RegisterInput {
  username: string;
  email: string;
  password: string;
}

interface SessionContextValue {
  session: SessionInfo | undefined;
  user: User | null;
  loading: boolean;
  /** Test mode only: local account sign-in (identifier = username or email). */
  signIn: (identifier: string, password: string) => Promise<void>;
  /** Server accounts: sign in with an admin-issued 6-digit access key. */
  signInWithKey: (accessKey: string) => Promise<void>;
  /** Test mode only: create a local account. */
  register: (input: RegisterInput) => Promise<void>;
  /** Server accounts: full-page redirect to Google (optionally accepting an invite). */
  signInWithGoogle: (options?: { next?: string; invite?: string | null }) => void;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { data: session, isLoading } = useQuery({
    queryKey: ["session"],
    queryFn: () => api<SessionInfo>("/api/auth/session"),
    staleTime: 60_000,
  });

  const refreshUserData = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["session"] });
    queryClient.removeQueries({ queryKey: ["boards"] });
    queryClient.removeQueries({ queryKey: ["board"] });
    queryClient.removeQueries({ queryKey: ["watches"] });
    queryClient.removeQueries({ queryKey: ["creators"] });
    queryClient.removeQueries({ queryKey: ["access-key"] });
    queryClient.removeQueries({ queryKey: ["admin"] });
    await queryClient.invalidateQueries({ queryKey: ["saved"] });
  }, [queryClient]);

  const value = useMemo<SessionContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      loading: isLoading,
      // TEST_MODE: accounts live in localStorage. Otherwise: server accounts in the database.
      async signIn(identifier, password) {
        await loginLocalAccount(identifier, password);
        await refreshUserData();
      },
      async signInWithKey(accessKey) {
        await api("/api/auth/login", { method: "POST", json: { accessKey: accessKey.trim() } });
        await refreshUserData();
      },
      async register(input) {
        await registerLocalAccount(input);
        await refreshUserData();
      },
      signInWithGoogle({ next = "/explore", invite } = {}) {
        const params = new URLSearchParams({ next });
        if (invite) params.set("invite", invite);
        // A full-page redirect to an API route that hands off to Google's consent screen — not an in-app page,
        // so the router can't be used here.
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.assign(`${window.location.origin}/api/auth/google?${params}`);
      },
      async signOut() {
        if (session?.testMode) logoutLocalAccount();
        else await api("/api/auth/logout", { method: "POST" });
        // Invite-only workspaces lock every page once signed out: start clean on the sign-in page.
        if (session?.accessMode === "invite" && !session.testMode) {
          window.location.replace("/login");
          return;
        }
        await refreshUserData();
      },
    }),
    [session, isLoading, refreshUserData],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside SessionProvider");
  return ctx;
}
