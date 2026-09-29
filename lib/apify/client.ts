import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import { env } from "../env";

const API = "https://api.apify.com/v2";
const TERMINAL = new Set(["SUCCEEDED", "FAILED", "ABORTED", "TIMED-OUT"]);

export type RawItem = Record<string, unknown>;

/** A "load more" slice: `index` 1, 2, … and, for X, the date to page back from (oldest stored post). */
export interface ScrapePage {
  index: number;
  before?: string | null;
}

interface ApifyRun {
  id: string;
  status: string;
  statusMessage?: string;
  defaultDatasetId: string;
}

// Apify plans cap how many actor runs may be *running* at once (free plan: 5) and reject the rest with
// 402 "concurrent-runs-limit-exceeded". Every run here takes a slot from start until it finishes, so a
// search (3 platforms, plus related queries) and creator fetches queue instead of failing. Background work
// (related searches) runs with low priority, so a search's own runs always go first.
const MAX_CONCURRENT = Math.max(1, Number(process.env.APIFY_MAX_CONCURRENT) || 5);
// Kept on globalThis: Next can load this module once per route bundle (scrape, creator fetch, cron), and
// they must all share one queue.
interface SlotQueue {
  active: number;
  high: (() => void)[];
  low: (() => void)[];
  priority: AsyncLocalStorage<"low">;
}
const queue: SlotQueue = ((globalThis as { __virallensApifyQueue?: SlotQueue }).__virallensApifyQueue ??= {
  active: 0,
  high: [],
  low: [],
  priority: new AsyncLocalStorage<"low">(),
});

/** Runs `fn` with its Apify actor runs queued behind everyone else's (used for related-query searches). */
export const withLowPriority = <T>(fn: () => Promise<T>) => queue.priority.run("low", fn);

async function acquireSlot() {
  if (queue.active < MAX_CONCURRENT) {
    queue.active++;
    return;
  }
  await new Promise<void>((resolve) => queue[queue.priority.getStore() === "low" ? "low" : "high"].push(resolve));
}

function releaseSlot() {
  const next = queue.high.shift() ?? queue.low.shift();
  if (next) next(); // hands the slot straight over
  else queue.active--;
}

/** Another process (cron, a second server) can still fill the account's quota: wait and retry the start. */
const CONCURRENCY_RETRY_MS = [3_000, 6_000, 12_000, 20_000, 30_000];
const isConcurrencyLimit = (error: unknown) =>
  error instanceof Error && /Apify (402|429)/.test(error.message) && /concurrent|rate-limit|too many/i.test(error.message);

async function apify<T>(path: string, init?: RequestInit): Promise<T> {
  const token = env.apifyToken;
  if (!token) throw new Error("APIFY_API_TOKEN is not configured");
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...init?.headers },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Apify ${res.status}: ${body.slice(0, 300)}`);
  }
  return res.json() as Promise<T>;
}

/** Starts an actor run and returns immediately. Actor ids like "user/actor" are converted to "user~actor". */
export async function startActor(actorId: string, input: unknown): Promise<ApifyRun> {
  const { data } = await apify<{ data: ApifyRun }>(`/acts/${actorId.replace("/", "~")}/runs`, {
    method: "POST",
    body: JSON.stringify(input),
  });
  return data;
}

/** Long-polls the run until it reaches a terminal state (or maxWaitMs elapses). */
export async function waitForRun(runId: string, maxWaitMs = 280_000): Promise<ApifyRun> {
  const deadline = Date.now() + maxWaitMs;
  for (;;) {
    const remaining = Math.max(1, Math.min(60, Math.floor((deadline - Date.now()) / 1000)));
    const { data } = await apify<{ data: ApifyRun }>(`/actor-runs/${runId}?waitForFinish=${remaining}`);
    if (TERMINAL.has(data.status)) return data;
    if (Date.now() >= deadline) throw new Error(`Apify run ${runId} did not finish in time (status ${data.status})`);
  }
}

export async function getDatasetItems(datasetId: string, limit: number): Promise<RawItem[]> {
  return apify<RawItem[]>(`/datasets/${datasetId}/items?clean=true&format=json&limit=${limit}`);
}

/** Runs an actor end-to-end: (queue for a slot) → start → poll → fetch dataset items. */
export async function runActor(actorId: string, input: unknown, limit: number, onStart?: (runId: string) => void): Promise<RawItem[]> {
  await acquireSlot();
  let finished: ApifyRun;
  try {
    let run: ApifyRun | undefined;
    for (let attempt = 0; !run; attempt++) {
      try {
        run = await startActor(actorId, input);
      } catch (error) {
        if (!isConcurrencyLimit(error) || attempt >= CONCURRENCY_RETRY_MS.length) throw error;
        await new Promise((resolve) => setTimeout(resolve, CONCURRENCY_RETRY_MS[attempt]));
      }
    }
    onStart?.(run.id);
    finished = await waitForRun(run.id);
  } finally {
    releaseSlot();
  }
  if (finished.status !== "SUCCEEDED") {
    throw new Error(`Apify run ${finished.status.toLowerCase()}${finished.statusMessage ? `: ${finished.statusMessage}` : ""}`);
  }
  return getDatasetItems(finished.defaultDatasetId, limit);
}

/**
 * Builds actor input, honouring an optional APIFY_INPUT_<...> JSON override. Every key of `vars` is a
 * {{placeholder}} (topic searches: {{topic}}, {{hashtag}}, {{limit}}; creators: {{handle}}, {{profileUrl}}, {{limit}}).
 */
export function buildInput(envKey: string, fallback: Record<string, unknown>, vars: { limit: number } & Record<string, string | number>) {
  const template = process.env[envKey]?.trim();
  if (!template) return fallback;
  try {
    const parsed = JSON.parse(template);
    const fill = (value: unknown): unknown => {
      if (typeof value === "string") {
        if (value === "{{limit}}") return vars.limit;
        return Object.entries(vars).reduce((text, [key, v]) => text.replaceAll(`{{${key}}}`, String(v)), value);
      }
      if (Array.isArray(value)) return value.map(fill);
      if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, fill(v)]));
      return value;
    };
    return fill(parsed) as Record<string, unknown>;
  } catch {
    console.warn(`[virallens] ${envKey} is not valid JSON; using default actor input`);
    return fallback;
  }
}
