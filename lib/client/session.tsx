"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import type { SessionInfo, User } from "../types";
import { api } from "./api";
import { loginLocalAccount, logoutLocalAccount, registerLocalAccount } from "./local-accounts";

export interface RegisterInput {
  username: string;
  email: string;
  password: string;
}

interface SessionContextValue {
  session: SessionInfo | undefined;
  user: User | null;
  loading: boolean;
  /** identifier = username or email */
  signIn: (identifier: string, password: string) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
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
    await queryClient.invalidateQueries({ queryKey: ["saved"] });
  }, [queryClient]);

  const value = useMemo<SessionContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      loading: isLoading,
      // TEST_MODE: accounts live in localStorage. Otherwise: server accounts in the database.
      async signIn(identifier, password) {
        if (session?.testMode) await loginLocalAccount(identifier, password);
        else await api("/api/auth/login", { method: "POST", json: { identifier, password } });
        await refreshUserData();
      },
      async register(input) {
        if (session?.testMode) await registerLocalAccount(input);
        else await api("/api/auth/register", { method: "POST", json: input });
        await refreshUserData();
      },
      async signOut() {
        if (session?.testMode) logoutLocalAccount();
        else await api("/api/auth/logout", { method: "POST" });
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
