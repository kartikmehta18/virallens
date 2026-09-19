import "server-only";
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

/** Runs an actor end-to-end: start → poll → fetch dataset items. */
export async function runActor(actorId: string, input: unknown, limit: number, onStart?: (runId: string) => void): Promise<RawItem[]> {
  const run = await startActor(actorId, input);
  onStart?.(run.id);
  const finished = await waitForRun(run.id);
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
