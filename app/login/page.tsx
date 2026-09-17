"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertCircle, FlaskConical, KeyRound, Loader2, MailOpen, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import { MyAccessKey } from "@/components/account/my-access-key";
import { AsciiField } from "@/components/ui/ascii-field";
import { inputClass, segmentClass } from "@/components/ui/form";
import { ChamferCard, LogoMark } from "@/components/ui/primitives";
import { api } from "@/lib/client/api";
import { useSession } from "@/lib/client/session";
import type { Role } from "@/lib/types";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

type InviteDetails = { email: string | null; name: string | null; role: Role; expiresAt: string };

const ERROR_MESSAGES: Record<string, string> = {
  not_invited: "That Google account hasn't been invited to ViralLens. Ask an admin for an invite link or an access key.",
  invite_invalid: "This invite link is no longer valid — it was used, revoked or has expired.",
  invite_email_mismatch: "This invite is for a different email address. Sign in with the Google account it was sent to.",
  account_disabled: "This account has been disabled. Contact your admin.",
  google_unverified: "Your Google account's email address isn't verified.",
  google_mismatch: "This email is already linked to a different Google account.",
  google_cancelled: "Google sign-in was cancelled.",
  google_state: "Your sign-in session expired. Please try again.",
  google_disabled: "Google sign-in isn't configured on this server.",
  google_failed: "Google sign-in failed. Please try again.",
};

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-[18px] shrink-0" aria-hidden>
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.58-5.17 3.58-8.81z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.88-3c-1.07.72-2.45 1.15-4.06 1.15-3.13 0-5.78-2.11-6.72-4.95H1.27v3.1A12 12 0 0 0 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.29A7.2 7.2 0 0 1 4.9 12c0-.8.14-1.57.38-2.29v-3.1H1.27A12 12 0 0 0 0 12c0 1.94.46 3.77 1.27 5.39l4.01-3.1z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.76 0 3.34.61 4.59 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.27 6.61l4.01 3.1C6.22 6.86 8.87 4.75 12 4.75z"
      />
    </svg>
  );
}

function LoginForm() {
  const { session, user, signIn, signInWithKey, signInWithGoogle, register, signOut } = useSession();
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next")?.startsWith("/") && !params.get("next")!.startsWith("//") ? params.get("next")! : "/explore";
  const inviteToken = params.get("invite");
  const errorCode = params.get("error");

  const serverAccounts = session ? !session.testMode : false;
  const inviteOnly = session?.accessMode === "invite";
  const [testMode, setTestMode] = useState<"login" | "register">(params.get("mode") === "register" ? "register" : "login");

  const [accessKey, setAccessKey] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(errorCode ? (ERROR_MESSAGES[errorCode] ?? ERROR_MESSAGES.google_failed) : null);
  const [pending, setPending] = useState(false);
  const [redirecting, setRedirecting] = useState(false);

  const acceptingInvite = Boolean(inviteToken && serverAccounts && !user);
  const invite = useQuery({
    queryKey: ["invite", inviteToken],
    queryFn: () => api<InviteDetails>(`/api/auth/invite?token=${encodeURIComponent(inviteToken!)}`),
    enabled: acceptingInvite,
    retry: false,
  });

  const run = async (action: () => Promise<void>) => {
    setError(null);
    setPending(true);
    try {
      await action();
      // Full navigation: the client router may hold a cached "redirect to /login" for the target page from
      // before sign-in (invite-only gate), so a soft navigation would bounce back here.
      if (serverAccounts) window.location.replace(next);
      else router.replace(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setPending(false);
    }
  };

  const google = () => {
    setRedirecting(true);
    signInWithGoogle({ next, invite: acceptingInvite ? inviteToken : null });
  };

  const onKeySubmit = (e: FormEvent) => {
    e.preventDefault();
    void run(() => signInWithKey(accessKey));
  };

  const onTestSubmit = (e: FormEvent) => {
    e.preventDefault();
    void run(() => (testMode === "login" ? signIn(identifier, password) : register({ username, email, password })));
  };

  const errorBanner = error && (
    <p
      role="alert"
      className="mt-4 flex gap-2 rounded-md border border-red-500/30 bg-red-500/10 p-3 text-[13px] leading-relaxed text-red-300"
    >
      <AlertCircle className="mt-px size-4 shrink-0" />
      {error}
    </p>
  );

  return (
    <div className="relative flex min-h-[calc(100vh-4rem)] items-center justify-center overflow-hidden px-4 py-12">
      <div aria-hidden className="absolute inset-0">
        <AsciiField variant="cta" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_34%_46%_at_50%_50%,var(--background)_0%,color-mix(in_oklab,var(--background)_80%,transparent)_55%,transparent_85%)]" />
      </div>

      <ChamferCard cut={28} className="relative w-full max-w-[420px] shadow-2xl" innerClassName="p-6 sm:p-8">
        <LogoMark className="size-9" />
        <h1 className="display mt-6 text-[26px] sm:text-[28px]">
          {user ? (
            <>
              You&apos;re <b>signed in</b>
            </>
          ) : acceptingInvite ? (
            <>
              You&apos;re <b>invited</b>
            </>
          ) : session?.testMode && testMode === "register" ? (
            <>
              Create your <b>account</b>
            </>
          ) : (
            <>
              Welcome <b>back</b>
            </>
          )}
        </h1>

        {!session ? (
          <Loader2 className="text-muted mt-6 size-5 animate-spin" />
        ) : user ? (
          <div className="mt-6 space-y-4 text-sm">
            <dl className="divide-border border-border divide-y rounded-md border">
              {[
                ["Name", user.name ?? (user.username ? `@${user.username}` : "—")],
                ["Email", user.email ?? "—"],
                ["Role", user.role === "admin" ? "Admin" : "User"],
                ["User ID", user.id],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-4 px-3.5 py-2.5">
                  <dt className="text-muted shrink-0">{label}</dt>
                  <dd className={`min-w-0 truncate text-right ${label === "User ID" ? "font-mono text-xs" : ""}`}>{value}</dd>
                </div>
              ))}
            </dl>
            <MyAccessKey compact />
            <div className="flex flex-wrap gap-2">
              <button onClick={() => (serverAccounts ? window.location.assign(next) : router.replace(next))} className="btn-primary flex-1">
                Continue
              </button>
              {user.role === "admin" && !session.testMode && (
                <Link href="/admin" className="btn-secondary">
                  <ShieldCheck className="size-4" /> Admin
                </Link>
              )}
              <button onClick={() => signOut()} className="btn-secondary">
                Sign out
              </button>
            </div>
          </div>
        ) : session.testMode ? (
          // ── Test mode: local accounts kept in this browser ──
          <>
            <div className="border-border mt-6 grid grid-cols-2 rounded-md border p-1">
              {(["login", "register"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setTestMode(m);
                    setError(null);
                  }}
                  className={segmentClass(testMode === m)}
                >
                  {m === "login" ? "Sign in" : "Create account"}
                </button>
              ))}
            </div>
            <p className="border-border bg-surface-2/60 text-muted mt-4 flex gap-2.5 rounded-md border p-3 text-xs leading-relaxed">
              <FlaskConical className="text-accent mt-px size-4 shrink-0" />
              Test mode — your account (ID, username, email, password) is saved in this browser&apos;s localStorage.
            </p>
            <form onSubmit={onTestSubmit} className="mt-4 space-y-3">
              {testMode === "login" ? (
                <input
                  className={inputClass}
                  required
                  autoComplete="username"
                  placeholder="Username or email"
                  aria-label="Username or email"
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
                    aria-label="Username"
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
                    aria-label="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </>
              )}
              <input
                className={inputClass}
                type="password"
                required
                minLength={testMode === "register" ? 8 : undefined}
                autoComplete={testMode === "login" ? "current-password" : "new-password"}
                placeholder={testMode === "register" ? "Password (min. 8 characters)" : "Password"}
                aria-label="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              {errorBanner}
              <button disabled={pending} className="btn-primary mt-2 w-full">
                {pending && <Loader2 className="size-4 animate-spin" />}
                {testMode === "login" ? "Sign In" : "Create Account"}
              </button>
            </form>
          </>
        ) : (
          // ── Server accounts: Google or a 6-digit access key ──
          <>
            {acceptingInvite ? (
              <div className="border-border bg-surface-2/60 text-muted mt-5 flex gap-2.5 rounded-md border p-3 text-xs leading-relaxed">
                <MailOpen className="text-accent mt-px size-4 shrink-0" />
                {invite.isLoading ? (
                  "Checking your invite…"
                ) : invite.isError ? (
                  <span className="text-red-300">{invite.error.message}</span>
                ) : (
                  <span>
                    Continue with Google to join{invite.data?.role === "admin" ? " as an admin" : ""}.
                    {invite.data?.email ? (
                      <>
                        {" "}
                        Use the Google account for <span className="text-foreground">{invite.data.email}</span>.
                      </>
                    ) : null}{" "}
                    You&apos;ll also get an access key you can view any time on your account.
                  </span>
                )}
              </div>
            ) : (
              inviteOnly && (
                <p className="text-muted mt-4 text-xs leading-relaxed">
                  ViralLens is <span className="text-foreground">invite-only</span>. Sign in with the Google account your admin added, or
                  with your access key.
                </p>
              )
            )}

            {errorBanner}

            {session.googleEnabled ? (
              <button
                type="button"
                onClick={google}
                disabled={redirecting || (acceptingInvite && (invite.isLoading || invite.isError))}
                className="border-border bg-foreground text-background hover:bg-foreground/90 mt-5 flex h-11 w-full items-center justify-center gap-3 rounded-md border text-[14px] font-medium transition disabled:opacity-60"
              >
                {redirecting ? <Loader2 className="size-4 animate-spin" /> : <GoogleIcon />}
                Continue with Google
              </button>
            ) : (
              <p className="border-border text-muted mt-5 rounded-md border p-3 text-xs">
                Google sign-in isn&apos;t configured (set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET).
              </p>
            )}

            {!acceptingInvite && (
              <>
                <div className="text-muted my-5 flex items-center gap-3 text-[11.5px] tracking-wide uppercase">
                  <span className="bg-border h-px flex-1" />
                  or use an access key
                  <span className="bg-border h-px flex-1" />
                </div>
                <form onSubmit={onKeySubmit} className="flex gap-2">
                  <div className="relative min-w-0 flex-1">
                    <KeyRound className="text-muted pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2" />
                    <input
                      className={`${inputClass} pl-10 font-mono tracking-[0.35em]`}
                      required
                      autoComplete="one-time-code"
                      inputMode="numeric"
                      spellCheck={false}
                      maxLength={7}
                      placeholder="••••••"
                      aria-label="Access key"
                      value={accessKey}
                      onChange={(e) => setAccessKey(e.target.value.replace(/[^\d\s-]/g, ""))}
                    />
                  </div>
                  <button disabled={pending || accessKey.replace(/\D/g, "").length !== 6} className="btn-secondary h-11 shrink-0 px-4">
                    {pending ? <Loader2 className="size-4 animate-spin" /> : "Sign In"}
                  </button>
                </form>
              </>
            )}

            <p className="text-muted mt-6 text-center text-xs">
              {acceptingInvite ? (
                <Link href="/login" className="text-foreground/80 hover:text-foreground">
                  Already have an account? Sign in
                </Link>
              ) : (
                <>
                  By continuing you agree to use ViralLens for research.{" "}
                  <Link href="/" className="text-foreground/80 hover:text-foreground">
                    Learn more
                  </Link>
                </>
              )}
            </p>
          </>
        )}
      </ChamferCard>
    </div>
  );
}
