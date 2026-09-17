"use client";

import { FlaskConical, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import { AsciiField } from "@/components/ui/ascii-field";
import { inputClass, segmentClass } from "@/components/ui/form";
import { ChamferCard, LogoMark } from "@/components/ui/primitives";
import { useSession } from "@/lib/client/session";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const { session, user, signIn, register, signOut } = useSession();
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next")?.startsWith("/") ? params.get("next")! : "/explore";

  const [mode, setMode] = useState<"login" | "register">(params.get("mode") === "register" ? "register" : "login");
  const [identifier, setIdentifier] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      if (mode === "login") await signIn(identifier, password);
      else await register({ username, email, password });
      router.replace(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="relative flex min-h-[calc(100vh-4rem)] items-center justify-center overflow-hidden px-4 py-12">
      <div aria-hidden className="absolute inset-0">
        <AsciiField variant="cta" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_34%_46%_at_50%_50%,var(--background)_0%,color-mix(in_oklab,var(--background)_80%,transparent)_55%,transparent_85%)]" />
      </div>

      <ChamferCard cut={28} className="relative w-full max-w-[400px] shadow-2xl" innerClassName="p-8">
        <LogoMark className="size-9" />
        <h1 className="display mt-6 text-[28px]">
          {user ? (
            <>
              You&apos;re <b>signed in</b>
            </>
          ) : mode === "login" ? (
            <>
              Welcome <b>back</b>
            </>
          ) : (
            <>
              Create your <b>account</b>
            </>
          )}
        </h1>

        {!session ? (
          <Loader2 className="text-muted mt-6 size-5 animate-spin" />
        ) : user ? (
          <div className="mt-6 space-y-4 text-sm">
            <dl className="divide-border border-border divide-y rounded-md border">
              {[
                ["Username", user.username ? `@${user.username}` : (user.name ?? "—")],
                ["Email", user.email],
                ["User ID", user.id],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-4 px-3.5 py-2.5">
                  <dt className="text-muted">{label}</dt>
                  <dd className={`truncate text-right ${label === "User ID" ? "font-mono text-xs" : ""}`}>{value}</dd>
                </div>
              ))}
            </dl>
            <div className="flex gap-2">
              <button onClick={() => router.replace(next)} className="btn-primary flex-1">
                Continue
              </button>
              <button onClick={() => signOut()} className="btn-secondary">
                Sign out
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="border-border mt-6 grid grid-cols-2 rounded-md border p-1">
              {(["login", "register"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setMode(m);
                    setError(null);
                  }}
                  className={segmentClass(mode === m)}
                >
                  {m === "login" ? "Sign in" : "Create account"}
                </button>
              ))}
            </div>

            {session.testMode && (
              <p className="border-border bg-surface-2/60 text-muted mt-4 flex gap-2.5 rounded-md border p-3 text-xs leading-relaxed">
                <FlaskConical className="text-accent mt-px size-4 shrink-0" />
                Test mode — your account (ID, username, email, password) is saved in this browser&apos;s localStorage.
              </p>
            )}

            <form onSubmit={onSubmit} className="mt-4 space-y-3">
              {mode === "login" ? (
                <input
                  className={inputClass}
                  required
                  autoComplete="username"
                  placeholder="Username or email"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                />
              ) : (
                <>
                  <input
                    className={inputClass}
                    required
                    autoComplete="username"
                    placeholder="Username"
                    pattern="[A-Za-z0-9_.]{3,32}"
                    title="3–32 characters: letters, numbers, _ or ."
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                  />
                  <input
                    className={inputClass}
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </>
              )}
              <input
                className={inputClass}
                type="password"
                required
                minLength={mode === "register" ? 8 : undefined}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                placeholder={mode === "register" ? "Password (min. 8 characters)" : "Password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />

              {error && <p className="text-sm text-red-400">{error}</p>}

              <button disabled={pending} className="btn-primary mt-2 w-full">
                {pending && <Loader2 className="size-4 animate-spin" />}
                {mode === "login" ? "Sign In" : "Create Account"}
              </button>
            </form>

            <p className="text-muted mt-6 text-center text-xs">
              By continuing you agree to use ViralLens for research.{" "}
              <Link href="/" className="text-foreground/80 hover:text-foreground">
                Learn more
              </Link>
            </p>
          </>
        )}
      </ChamferCard>
    </div>
  );
}
