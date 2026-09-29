import "server-only";
import { DEMO_TOPICS, generateDemoPosts } from "../apify/demo";
import { env } from "../env";
import { PLATFORMS } from "../types";
import { memoryRepository } from "./memory";
import type { Repository } from "./types";

const globalRepo = globalThis as unknown as { __viralLensRepo?: Promise<Repository> };

async function createRepository(): Promise<Repository> {
  let repo: Repository = memoryRepository;
  if (env.dbEnabled) {
    try {
      const { createPrismaRepository } = await import("./prisma");
      repo = createPrismaRepository();
      await repo.posts.count(); // verify the connection up front
    } catch (error) {
      console.error("[virallens] Database unavailable, falling back to in-memory store:", error);
      repo = memoryRepository;
    }
  }

  // Without Apify there is nothing to scrape, so seed demo content for an empty store.
  if (!env.apifyToken && (await repo.posts.count()) === 0) {
    const demo = DEMO_TOPICS.flatMap((topic) => PLATFORMS.flatMap((platform) => generateDemoPosts(topic, platform, 8)));
    await repo.posts.upsertMany(demo);
  }
  return repo;
}

/**
 * The instance lives on globalThis so it survives hot reloads — so in development, one built before an edit
 * to the repository code lacks the methods added since. The in-memory repository is always this build's code:
 * a cached instance missing any of its methods is stale and gets rebuilt (cheap — the Prisma client and the
 * in-memory data are cached separately).
 */
function isStale(repo: Repository): boolean {
  return Object.entries(memoryRepository).some(([group, methods]) => {
    if (!methods || typeof methods !== "object") return false;
    const cached = repo[group as keyof Repository] as unknown as Record<string, unknown> | undefined;
    return Object.keys(methods).some((method) => typeof cached?.[method] !== "function");
  });
}

/** Returns the active storage backend: MySQL via Prisma when DB env vars exist, otherwise in-memory. */
export function getRepo(): Promise<Repository> {
  const pending = (globalRepo.__viralLensRepo ??= createRepository().catch((error) => {
    globalRepo.__viralLensRepo = undefined;
    throw error;
  }));
  return pending.then((repo) => {
    if (!isStale(repo)) return repo;
    // Only the first caller to notice resets it; concurrent callers then share the rebuilt instance.
    if (globalRepo.__viralLensRepo === pending) globalRepo.__viralLensRepo = undefined;
    return getRepo();
  });
}
