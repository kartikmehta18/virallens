"use client";

// TEST_MODE accounts: stored entirely in this browser's localStorage. The generated `id`
// is what the server trusts (sent as a header). Passwords are SHA-256 hashed with a per-account
// salt so they aren't stored in plain text, but this is not meant as production security.

const ACCOUNTS_KEY = "virallens:test-accounts";
const CURRENT_KEY = "virallens:test-user";

export interface LocalAccount {
  id: string;
  username: string;
  email: string;
  salt: string;
  passwordHash: string;
  createdAt: string;
}

export type TestIdentity = Pick<LocalAccount, "id" | "username" | "email">;

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

const accounts = () => read<LocalAccount[]>(ACCOUNTS_KEY, []);

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** The signed-in local account (id + username + email), or null. */
export function getTestIdentity(): TestIdentity | null {
  const current = read<{ id?: string } | null>(CURRENT_KEY, null);
  const account = current?.id ? accounts().find((a) => a.id === current.id) : undefined;
  return account ? { id: account.id, username: account.username, email: account.email } : null;
}

export async function registerLocalAccount(input: { username: string; email: string; password: string }): Promise<TestIdentity> {
  const username = input.username.trim().toLowerCase();
  const email = input.email.trim().toLowerCase();
  const list = accounts();
  if (list.some((a) => a.username === username)) throw new Error("That username is taken on this browser");
  if (list.some((a) => a.email === email)) throw new Error("An account with this email already exists on this browser");

  const salt = crypto.randomUUID();
  const account: LocalAccount = {
    id: `local_${crypto.randomUUID()}`,
    username,
    email,
    salt,
    passwordHash: await sha256(`${salt}:${input.password}`),
    createdAt: new Date().toISOString(),
  };
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify([...list, account]));
  localStorage.setItem(CURRENT_KEY, JSON.stringify({ id: account.id }));
  return { id: account.id, username, email };
}

export async function loginLocalAccount(identifier: string, password: string): Promise<TestIdentity> {
  const needle = identifier.trim().toLowerCase();
  const account = accounts().find((a) => a.username === needle || a.email === needle);
  if (!account || (await sha256(`${account.salt}:${password}`)) !== account.passwordHash) {
    throw new Error("Incorrect username/email or password");
  }
  localStorage.setItem(CURRENT_KEY, JSON.stringify({ id: account.id }));
  return { id: account.id, username: account.username, email: account.email };
}

export function logoutLocalAccount() {
  try {
    localStorage.removeItem(CURRENT_KEY);
  } catch {}
}
