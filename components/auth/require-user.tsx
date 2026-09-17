"use client";

import { Lock } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { ChamferCard } from "@/components/ui/primitives";
import { useSession } from "@/lib/client/session";

/** Renders children only for signed-in users; otherwise a sign-in prompt. */
export function RequireUser({ children, title }: { children: ReactNode; title: string }) {
  const { user, loading } = useSession();
  const pathname = usePathname();

  if (loading) return <div className="skeleton mx-auto mt-12 h-48 max-w-5xl rounded-lg" />;
  if (!user) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-5 py-16">
        <ChamferCard cut={24} className="w-full max-w-md" innerClassName="p-8 text-center">
          <span className="border-border bg-background mx-auto grid size-11 place-items-center rounded-md border">
            <Lock className="text-muted size-4" />
          </span>
          <h1 className="display mt-6 text-[28px]">
            Sign in to see your <b>{title}</b>
          </h1>
          <p className="text-muted mt-3 text-sm leading-relaxed">
            Save posts into boards and get alerts when the topics you watch start to take off.
          </p>
          <div className="mt-7 flex justify-center gap-3">
            <Link href={`/login?next=${encodeURIComponent(pathname)}`} className="btn-primary">
              Sign In
            </Link>
            <Link href={`/login?mode=register&next=${encodeURIComponent(pathname)}`} className="btn-secondary">
              Create account
            </Link>
          </div>
        </ChamferCard>
      </div>
    );
  }
  return <>{children}</>;
}
