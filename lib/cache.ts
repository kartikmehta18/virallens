import "server-only";
import { env } from "./env";

interface CacheBackend {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
  del(key: string): Promise<void>;
  /** Increments a counter, setting the TTL when the key is created. */
  incr(key: string, ttlSeconds: number): Promise<number>;
}

const globalCache = globalThis as unknown as {
  __viralLensMemCache?: Map<string, { value: string; expires: number }>;
  __viralLensCache?: Promise<CacheBackend>;
};

function memoryCache(): CacheBackend {
  const store = (globalCache.__viralLensMemCache ??= new Map());
  const live = (key: string) => {
    const entry = store.get(key);
    if (entry && entry.expires < Date.now()) {
      store.delete(key);
      return undefined;
    }
    return entry;
  };
  return {
    async get(key) {
      return live(key)?.value ?? null;
    },
    async set(key, value, ttl) {
      store.set(key, { value, expires: Date.now() + ttl * 1000 });
    },
    async del(key) {
      store.delete(key);
    },
    async incr(key, ttl) {
      const entry = live(key);
      const next = (entry ? Number(entry.value) : 0) + 1;
      store.set(key, { value: String(next), expires: entry?.expires ?? Date.now() + ttl * 1000 });
      return next;
    },
  };
}

async function redisCache(url: string): Promise<CacheBackend> {
  const { default: Redis } = await import("ioredis");
  const client = new Redis(url, { maxRetriesPerRequest: 2, lazyConnect: true });
  await client.connect();
  return {
    get: (key) => client.get(key),
    async set(key, value, ttl) {
      await client.set(key, value, "EX", ttl);
    },
    async del(key) {
      await client.del(key);
    },
    async incr(key, ttl) {
      const [[, count]] = (await client.multi().incr(key).expire(key, ttl, "NX").exec()) as [[Error | null, number]];
      return count;
    },
  };
}

/** Redis when REDIS_URL is set, otherwise a process-local memory cache. */
export function getCache(): Promise<CacheBackend> {
  globalCache.__viralLensCache ??= (async () => {
    const url = env.redisUrl;
    if (!url) return memoryCache();
    try {
      return await redisCache(url);
    } catch (error) {
      console.error("[virallens] Redis unavailable, using in-memory cache:", error);
      return memoryCache();
    }
  })();
  return globalCache.__viralLensCache;
}
