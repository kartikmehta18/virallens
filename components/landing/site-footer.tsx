import Link from "next/link";
import { PlatformIcon } from "@/components/icons/platform-icon";
import { CrossMark, LogoMark } from "@/components/ui/primitives";

const COLUMNS = [
  {
    title: "Product",
    links: [
      { label: "Explore", href: "/explore" },
      { label: "Creators", href: "/creators" },
      { label: "Boards", href: "/boards" },
      { label: "Alerts", href: "/watches" },
      { label: "Settings", href: "/settings" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Trending now", href: "/explore?sort=trending&dateRange=7d" },
      { label: "Most shared", href: "/explore?sort=shares" },
      { label: "Export CSV", href: "/api/posts/export" },
      { label: "System status", href: "/api/health" },
    ],
  },
  {
    title: "Account",
    links: [
      { label: "Sign in", href: "/login" },
      { label: "Create account", href: "/login?mode=register" },
    ],
  },
];

const FRAME = "polygon(28px 0, 100% 0, 100% calc(100% - 28px), calc(100% - 28px) 100%, 0 100%, 0 28px)";

export function SiteFooter() {
  return (
    <footer className="mx-auto max-w-[1440px] px-5 pb-10 sm:px-8 lg:px-10">
      <div className="bg-border p-px" style={{ clipPath: FRAME }}>
        <div className="bg-background px-6 py-10 sm:px-11 sm:py-12" style={{ clipPath: FRAME }}>
          <Link href="/" className="flex w-fit items-center gap-2.5 text-[17px] font-semibold tracking-tight">
            <LogoMark /> ViralLens
          </Link>

          <div className="mt-10 grid grid-cols-2 gap-x-6 gap-y-10 sm:mt-12 lg:grid-cols-4 lg:gap-0">
            {COLUMNS.map((column, i) => (
              <div key={column.title} className={`relative ${i > 0 ? "lg:border-border lg:border-l lg:pl-6" : ""}`}>
                {i > 0 && (
                  <>
                    <CrossMark className="-top-[5px] -left-[5px] hidden lg:block" />
                    <CrossMark className="-bottom-[5px] -left-[5px] hidden lg:block" />
                  </>
                )}
                <p className="text-[13px] font-semibold">{column.title}</p>
                <ul className="mt-5 space-y-3.5">
                  {column.links.map((link) => (
                    <li key={link.label}>
                      <Link href={link.href} className="text-muted hover:text-foreground text-[13px] transition">
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <div className="lg:border-border relative col-span-2 lg:col-span-1 lg:border-l lg:pl-6">
              <CrossMark className="-top-[5px] -left-[5px] hidden lg:block" />
              <CrossMark className="-bottom-[5px] -left-[5px] hidden lg:block" />
              <p className="text-[13px] font-semibold">Connect</p>
              <div className="mt-5 flex flex-row flex-wrap items-start gap-3 lg:flex-col">
                <Link href="/explore" className="btn-primary h-9">
                  Start exploring
                </Link>
                <Link href="/login" className="btn-secondary h-9">
                  Sign in
                </Link>
              </div>
            </div>
          </div>

          <div className="mt-14 flex flex-wrap items-center justify-between gap-4">
            <p className="text-muted text-xs">© {new Date().getFullYear()} ViralLens. All rights reserved.</p>
            <div className="divide-border text-muted flex items-center divide-x">
              {(
                [
                  ["x", "https://x.com"],
                  ["linkedin", "https://www.linkedin.com"],
                  ["instagram", "https://www.instagram.com"],
                ] as const
              ).map(([platform, href]) => (
                <a
                  key={platform}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={platform}
                  className="hover:text-foreground px-4 transition"
                >
                  <PlatformIcon platform={platform} className="size-3.5" />
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
