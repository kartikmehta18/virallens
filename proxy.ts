import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifyToken } from "./lib/auth/token";
import { resolveDbParts } from "./lib/db/url";

// Invite-only gate. When TEST_MODE is off, a database is configured and ACCESS_MODE isn't "open", every page
// and API except the landing page and sign-in requires a session cookie. This is the optimistic check (valid
// signature + expiry); API routes still verify the account in the database (disabled users, revoked sessions,
// admin role).

const PUBLIC_PAGES = new Set(["/", "/login"]);
// /api/landing serves the public marketing page; /api/media only proxies allowlisted social CDNs.
const PUBLIC_API_PREFIXES = ["/api/auth/", "/api/health", "/api/cron/", "/api/landing/", "/api/media"];
const truthy = (value: string | undefined) => ["on", "true", "1", "yes"].includes((value ?? "").trim().toLowerCase());

function inviteOnly() {
  return !truthy(process.env.TEST_MODE) && resolveDbParts() !== null && process.env.ACCESS_MODE?.trim().toLowerCase() !== "open";
}

export function proxy(request: NextRequest) {
  if (!inviteOnly()) return NextResponse.next();

  const { pathname, search } = request.nextUrl;
  if (PUBLIC_PAGES.has(pathname) || PUBLIC_API_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  let signedIn = false;
  try {
    signedIn = verifyToken(request.cookies.get(SESSION_COOKIE)?.value) !== null;
  } catch {
    // AUTH_SECRET missing in production: treat everyone as signed out.
  }
  if (signedIn) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Please sign in first" }, { status: 401 });
  }
  const login = new URL("/login", request.url);
  login.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(login);
}

export const config = {
  // Skip Next internals and static files (images, video, icons) so the landing page and login still render.
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:png|jpe?g|webp|svg|gif|ico|mp4|webm|txt|xml|woff2?)$).*)"],
};
