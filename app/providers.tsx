"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LayoutGroup, MotionConfig } from "motion/react";
import { useState, type ReactNode } from "react";
import { SessionProvider } from "@/lib/client/session";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: 1 } },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <MotionConfig reducedMotion="user">
          <LayoutGroup>{children}</LayoutGroup>
        </MotionConfig>
      </SessionProvider>
    </QueryClientProvider>
  );
}
