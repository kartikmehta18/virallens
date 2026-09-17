import { getCache } from "@/lib/cache";
import { env } from "@/lib/env";
import { getRepo } from "@/lib/repo";

export const dynamic = "force-dynamic";

export async function GET() {
  const started = Date.now();
  const checks: Record<string, unknown> = {};

  try {
    const repo = await getRepo();
    checks.storage = { ok: true, backend: repo.kind, posts: await repo.posts.count(), dbConfigured: env.dbEnabled };
  } catch (error) {
    checks.storage = { ok: false, error: error instanceof Error ? error.message : String(error) };
  }

  try {
    const cache = await getCache();
    await cache.set("health:ping", "1", 10);
    checks.cache = { ok: (await cache.get("health:ping")) === "1", backend: env.redisUrl ? "redis" : "memory" };
  } catch (error) {
    checks.cache = { ok: false, error: error instanceof Error ? error.message : String(error) };
  }

  checks.apify = { configured: Boolean(env.apifyToken), mode: env.apifyToken ? "live" : "demo" };
  checks.testMode = env.testMode;

  const ok = Object.values(checks).every((c) => typeof c !== "object" || c === null || (c as { ok?: boolean }).ok !== false);
  return Response.json({ ok, checks, latencyMs: Date.now() - started }, { status: ok ? 200 : 503 });
}
