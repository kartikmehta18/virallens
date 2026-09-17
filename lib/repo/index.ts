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

/** Returns the active storage backend: MySQL via Prisma when DB env vars exist, otherwise in-memory. */
export function getRepo(): Promise<Repository> {
  globalRepo.__viralLensRepo ??= createRepository().catch((error) => {
    globalRepo.__viralLensRepo = undefined;
    throw error;
  });
  return globalRepo.__viralLensRepo;
}
