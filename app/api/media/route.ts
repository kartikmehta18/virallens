import type { NextRequest } from "next/server";

// Social CDNs often block hotlinking (missing referrer / expiring signatures). This proxy streams
// media from an allowlist of hosts so thumbnails and videos render reliably in the grid.
const ALLOWED_HOSTS = [/(^|\.)cdninstagram\.com$/, /(^|\.)fbcdn\.net$/, /(^|\.)licdn\.com$/, /(^|\.)twimg\.com$/];
const HEADERS_TIMEOUT_MS = 15_000;

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("url");
  let target: URL;
  try {
    target = new URL(raw ?? "");
  } catch {
    return new Response("Invalid url", { status: 400 });
  }
  if (target.protocol !== "https:" || !ALLOWED_HOSTS.some((re) => re.test(target.hostname))) {
    return new Response("Host not allowed", { status: 403 });
  }

  // Give up if the CDN hasn't started answering within HEADERS_TIMEOUT_MS, so a stalled upstream can't pin
  // the browser's connection. The timer stops once headers arrive: large files may stream slowly after that.
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), HEADERS_TIMEOUT_MS);
  request.signal.addEventListener("abort", () => abort.abort());
  const range = request.headers.get("range");
  const upstream = await fetch(target, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36",
      Accept: request.headers.get("accept") ?? "*/*",
      ...(range && { Range: range }),
    },
    cache: "no-store",
    signal: abort.signal,
  })
    .catch(() => null)
    .finally(() => clearTimeout(timer));

  if (!upstream || (!upstream.ok && upstream.status !== 206)) {
    return new Response("Upstream media unavailable", { status: 502 });
  }

  const headers = new Headers({ "Cache-Control": "public, max-age=86400, immutable" });
  for (const name of ["content-type", "content-length", "content-range", "accept-ranges"]) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }
  return new Response(upstream.body, { status: upstream.status, headers });
}
