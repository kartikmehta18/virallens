"use client";

import {
  Bell,
  Bookmark,
  ChevronDown,
  Compass,
  FlaskConical,
  LogOut,
  Menu,
  Settings,
  Sparkles,
  User as UserIcon,
  Users,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { useSession } from "@/lib/client/session";
import { ThemeToggle } from "./theme-toggle";
import { LogoMark } from "./ui/primitives";

const PLATFORM_ITEMS = [
  {
    href: "/explore",
    icon: Compass,
    title: "Explore feed",
    body: "Viral posts across X, LinkedIn & Instagram",
    preview: "One ranked feed",
    detail: "A cross-platform virality score puts every post on the same scale.",
  },
  {
    href: "/explore?sort=engagement",
    icon: Sparkles,
    title: "AI breakdowns",
    body: "Why a post worked, in five bullets",
    preview: "Learn the pattern",
    detail: "Hook, format, CTA and emotional angle — explained for every post.",
  },
  {
    href: "/boards",
    icon: Bookmark,
    title: "Boards",
    body: "Collect and organize swipe files",
    preview: "Build a swipe file",
    detail: "Save the posts you want to remix into named, shareable boards.",
  },
  {
    href: "/creators",
    icon: Users,
    title: "Creators",
    body: "Save and study favorite creators",
    preview: "Follow the best",
    detail: "Profiles, stats and the latest posts of the creators you save — and a one-tap Explore filter.",
  },
  {
    href: "/watches",
    icon: Bell,
    title: "Alerts",
    body: "Get notified when topics take off",
    preview: "Catch the wave early",
    detail: "Watched topics are re-scraped on a schedule and emailed when they spike.",
  },
];

const NAV = [
  { href: "/explore", label: "Explore" },
  { href: "/creators", label: "Creators" },
  { href: "/boards", label: "Boards" },
  { href: "/watches", label: "Alerts" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const { user, session } = useSession();

  return (
    <header className="border-border/70 bg-background/85 sticky top-0 z-40 border-b backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-[1440px] items-center gap-2 px-4 sm:h-16 sm:px-8 lg:px-10">
        <Link href="/" className="mr-2 flex min-w-0 items-center gap-2.5 text-[17px] font-semibold tracking-tight lg:mr-4">
          <LogoMark />
          ViralLens
        </Link>

        <nav className="hidden items-center gap-1 lg:flex">
          <PlatformMenu />
          {NAV.map(({ href, label }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`rounded-md px-3 py-2 text-[13px] font-medium transition ${active ? "text-foreground" : "text-foreground/70 hover:text-foreground"}`}
              >
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          {session?.testMode && (
            <span
              className="border-border text-muted hidden items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-medium xl:flex"
              title="TEST_MODE is on: accounts are stored in this browser"
            >
              <FlaskConical className="text-accent size-3.5" /> Test mode
            </span>
          )}
          {session && !session.apifyEnabled && (
            <span
              className="border-border text-muted hidden rounded-md border px-2 py-1 text-[11px] font-medium xl:inline"
              title="No APIFY_API_TOKEN — searches generate demo posts"
            >
              Demo data
            </span>
          )}
          <div className="hidden sm:block">
            <ThemeToggle />
          </div>
          <Link
            href="/settings"
            aria-label="Settings"
            className={`hover:bg-surface-2 hidden size-9 place-items-center rounded-md transition sm:grid ${pathname.startsWith("/settings") ? "text-foreground" : "text-muted hover:text-foreground"}`}
          >
            <Settings className="size-4" />
          </Link>
          {user ? (
            <div className="hidden sm:block">
              <AccountMenu />
            </div>
          ) : (
            <>
              <Link href={`/login?next=${encodeURIComponent(pathname)}`} className="btn-secondary hidden h-9 sm:inline-flex">
                Sign In
              </Link>
              <Link
                href={`/login?mode=register&next=${encodeURIComponent(pathname === "/" ? "/explore" : pathname)}`}
                className="btn-primary h-9 px-3.5 text-[13px] sm:px-5"
              >
                Get Started
              </Link>
            </>
          )}
          <MobileMenu />
        </div>
      </div>
    </header>
  );
}

function useDismiss(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && close();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);
  return ref;
}

function PlatformMenu() {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const ref = useDismiss(open, () => setOpen(false));
  const item = PLATFORM_ITEMS[active];

  return (
    <div ref={ref} className="relative" onMouseLeave={() => setOpen(false)}>
      <button
        onClick={() => setOpen((o) => !o)}
        onMouseEnter={() => setOpen(true)}
        aria-expanded={open}
        className="text-foreground/70 hover:text-foreground flex items-center gap-1 rounded-md px-3 py-2 text-[13px] font-medium transition"
      >
        Platform <ChevronDown className={`size-3.5 transition ${open ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full left-0 pt-2"
          >
            <div className="border-border bg-surface grid w-[460px] grid-cols-[1fr_190px] rounded-lg border shadow-2xl">
              <div className="p-1.5">
                {PLATFORM_ITEMS.map((entry, i) => (
                  <Link
                    key={entry.title}
                    href={entry.href}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => setOpen(false)}
                    className={`flex items-start gap-3 rounded-md p-2.5 transition ${active === i ? "bg-surface-2" : ""}`}
                  >
                    <span className="border-border bg-background grid size-7 shrink-0 place-items-center rounded-md border">
                      <entry.icon className="size-3.5" />
                    </span>
                    <span>
                      <span className="block text-[13px] leading-tight font-medium">{entry.title}</span>
                      <span className="text-muted mt-0.5 block text-[11.5px] leading-snug">{entry.body}</span>
                    </span>
                  </Link>
                ))}
              </div>
              <div className="border-border flex flex-col border-l p-3">
                <div className="border-border bg-background relative mb-3 aspect-[4/3] overflow-hidden rounded-md border">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,color-mix(in_oklab,var(--accent)_35%,transparent),transparent_60%)]" />
                  <item.icon className="text-foreground/80 absolute right-3 bottom-3 size-8" />
                </div>
                <p className="text-[12.5px] font-medium">{item.preview}</p>
                <p className="text-muted mt-1 text-[11.5px] leading-snug">{item.detail}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function AccountMenu() {
  const { user, session, signOut } = useSession();
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, () => setOpen(false));
  if (!user) return null;
  const handle = user.username ?? user.name ?? user.email.split("@")[0];

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label="Account menu"
        className="bg-foreground text-background grid size-9 place-items-center rounded-full text-sm font-semibold transition hover:opacity-90"
      >
        {handle.slice(0, 2).toUpperCase()}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="border-border bg-surface absolute top-full right-0 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-lg border p-1.5 shadow-2xl"
          >
            <div className="border-border border-b px-2.5 pt-2 pb-3">
              <p className="text-sm font-medium">@{handle}</p>
              <p className="text-muted truncate text-xs">{user.email}</p>
              <p className="text-muted mt-2 truncate font-mono text-[10.5px]" title={user.id}>
                ID · {user.id}
              </p>
              {session?.testMode && <p className="text-accent mt-1 text-[10.5px]">Local test account</p>}
            </div>
            {[
              { href: "/creators", icon: Users, label: "Creators" },
              { href: "/boards", icon: Bookmark, label: "Boards" },
              { href: "/watches", icon: Bell, label: "Alerts" },
              { href: "/settings", icon: Settings, label: "Settings" },
              { href: "/login", icon: UserIcon, label: "Account" },
            ].map(({ href, icon: Icon, label }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className="hover:bg-surface-2 flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px]"
              >
                <Icon className="text-muted size-4" /> {label}
              </Link>
            ))}
            <button
              onClick={() => {
                setOpen(false);
                signOut();
              }}
              className="hover:bg-surface-2 flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[13px]"
            >
              <LogOut className="text-muted size-4" /> Sign out
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const noopSubscribe = () => () => {};

/** Below the lg breakpoint the nav, theme, settings and account live in this full-screen sheet. */
function MobileMenu() {
  const pathname = usePathname();
  const { user, session, signOut } = useSession();
  const [open, setOpen] = useState(false);
  const [openedOn, setOpenedOn] = useState(pathname);
  const mounted = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );

  // Close after navigation (adjusting state during render instead of in an effect).
  if (open && openedOn !== pathname) {
    setOpen(false);
    setOpenedOn(pathname);
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onResize = () => window.innerWidth >= 1024 && setOpen(false);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
    };
  }, [open]);

  const handle = user ? (user.username ?? user.name ?? user.email.split("@")[0]) : "";
  const links = [
    { href: "/explore", icon: Compass, label: "Explore", body: "The ranked viral feed" },
    { href: "/creators", icon: Users, label: "Creators", body: "Favorite creators and their posts" },
    { href: "/boards", icon: Bookmark, label: "Boards", body: "Your saved swipe files" },
    { href: "/watches", icon: Bell, label: "Alerts", body: "Topics you're watching" },
    { href: "/settings", icon: Settings, label: "Settings", body: "Search bar, theme and defaults" },
  ];

  return (
    <div className="lg:hidden">
      <button
        onClick={() => {
          setOpenedOn(pathname);
          setOpen((o) => !o);
        }}
        aria-expanded={open}
        aria-label={open ? "Close menu" : "Open menu"}
        className="border-border hover:bg-surface-2 grid size-9 place-items-center rounded-md border transition"
      >
        {open ? <X className="size-4" /> : <Menu className="size-4" />}
      </button>
      {mounted &&
        createPortal(
          <AnimatePresence>
            {open && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="bg-background fixed inset-x-0 top-14 bottom-0 z-50 overflow-y-auto overscroll-contain sm:top-16"
              >
                <motion.nav
                  initial={{ y: -10 }}
                  animate={{ y: 0 }}
                  exit={{ y: -10 }}
                  transition={{ duration: 0.22, ease: "easeOut" }}
                  className="mx-auto flex min-h-full max-w-xl flex-col px-4 pt-3 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-8"
                >
                  <div className="divide-border border-border divide-y border-b">
                    {links.map(({ href, icon: Icon, label, body }) => {
                      const active = pathname.startsWith(href);
                      return (
                        <Link key={href} href={href} onClick={() => setOpen(false)} className="flex items-center gap-4 py-4">
                          <span
                            className={`grid size-10 shrink-0 place-items-center rounded-md border ${active ? "border-accent/60 text-accent" : "border-border text-foreground/80"}`}
                          >
                            <Icon className="size-[18px]" />
                          </span>
                          <span className="min-w-0">
                            <span className="block text-[16px] font-medium">{label}</span>
                            <span className="text-muted block truncate text-[13px]">{body}</span>
                          </span>
                        </Link>
                      );
                    })}
                  </div>

                  <div className="border-border flex items-center justify-between border-b py-3">
                    <span className="text-[14px] font-medium">Theme</span>
                    <ThemeToggle />
                  </div>

                  {session && (session.testMode || !session.apifyEnabled) && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {session.testMode && (
                        <span className="border-border text-muted flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-medium">
                          <FlaskConical className="text-accent size-3.5" /> Test mode
                        </span>
                      )}
                      {!session.apifyEnabled && (
                        <span className="border-border text-muted rounded-md border px-2 py-1 text-[11px] font-medium">Demo data</span>
                      )}
                    </div>
                  )}

                  <div className="mt-auto pt-8">
                    {user ? (
                      <div className="border-border bg-surface rounded-lg border p-4">
                        <div className="flex items-center gap-3">
                          <span className="bg-foreground text-background grid size-10 shrink-0 place-items-center rounded-full text-sm font-semibold">
                            {handle.slice(0, 2).toUpperCase()}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">@{handle}</p>
                            <p className="text-muted truncate text-xs">{user.email}</p>
                          </div>
                        </div>
                        <p className="text-muted mt-3 truncate font-mono text-[10.5px]" title={user.id}>
                          ID · {user.id}
                        </p>
                        <button
                          onClick={() => {
                            setOpen(false);
                            signOut();
                          }}
                          className="btn-secondary mt-4 h-10 w-full"
                        >
                          <LogOut className="size-4" /> Sign out
                        </button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-3">
                        <Link
                          href={`/login?next=${encodeURIComponent(pathname)}`}
                          onClick={() => setOpen(false)}
                          className="btn-secondary h-11"
                        >
                          Sign In
                        </Link>
                        <Link
                          href={`/login?mode=register&next=${encodeURIComponent(pathname === "/" ? "/explore" : pathname)}`}
                          onClick={() => setOpen(false)}
                          className="btn-primary h-11"
                        >
                          Get Started
                        </Link>
                      </div>
                    )}
                  </div>
                </motion.nav>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </div>
  );
}
