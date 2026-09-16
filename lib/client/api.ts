"use client";

import { getTestIdentity } from "./local-accounts";

export class ApiRequestError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** fetch wrapper: JSON in/out, attaches the localStorage identity headers (ignored by the server unless TEST_MODE=on). */
export async function api<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, headers, ...rest } = init;
  const identity = typeof window !== "undefined" ? getTestIdentity() : null;
  const res = await fetch(path, {
    ...rest,
    body: json === undefined ? rest.body : JSON.stringify(json),
    headers: {
      ...(json !== undefined && { "Content-Type": "application/json" }),
      ...(identity && {
        "x-vl-user-id": identity.id,
        "x-vl-user-name": encodeURIComponent(identity.username),
        "x-vl-user-email": encodeURIComponent(identity.email),
      }),
      ...headers,
    },
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiRequestError(res.status, data?.error ?? `Request failed (${res.status})`);
  return data as T;
}
