import "server-only";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../generated/prisma/client";
import { resolveDbParts } from "./url";

const globalForPrisma = globalThis as unknown as { __viralLensPrisma?: PrismaClient };

// Read-only operations are safe to replay when the connection dropped mid-flight.
const RETRYABLE_OPERATIONS = new Set([
  "findMany",
  "findUnique",
  "findUniqueOrThrow",
  "findFirst",
  "findFirstOrThrow",
  "count",
  "groupBy",
  "aggregate",
  "$queryRaw",
]);
const TRANSIENT_ERROR =
  /ECONNRESET|EPIPE|ETIMEDOUT|socket has unexpectedly been closed|Connection timeout|pool timeout|connection closed|Cannot execute new commands: connection closed/i;

const isTransient = (error: unknown) =>
  error instanceof Error &&
  (TRANSIENT_ERROR.test(error.message) || ["P1001", "P1017", "P2039"].includes((error as { code?: string }).code ?? ""));

/** Lazily-created Prisma client (MySQL/MariaDB via the mariadb driver adapter). */
export function getPrisma(): PrismaClient {
  if (globalForPrisma.__viralLensPrisma) return globalForPrisma.__viralLensPrisma;

  const parts = resolveDbParts();
  if (!parts) throw new Error("Database is not configured");

  const adapter = new PrismaMariaDb(
    {
      host: parts.host,
      port: parts.port,
      user: parts.user,
      password: parts.password,
      database: parts.database,
      connectionLimit: Number(process.env.DB_CONNECTION_LIMIT) || 5,
      // Shared hosts (Hostinger: wait_timeout = 20s) kill idle connections quickly. Release pooled
      // connections before the server does, so a request never picks up a dead socket (ECONNRESET).
      idleTimeout: Number(process.env.DB_IDLE_TIMEOUT) || 10,
      minimumIdle: 1,
      connectTimeout: 15_000,
      acquireTimeout: 20_000,
    },
    // The binary protocol binds strings with a binary collation, which MariaDB rejects in
    // `LIKE` against utf8mb4_unicode_ci columns (error 1267). The text protocol avoids that.
    { useTextProtocol: true },
  );

  const client = new PrismaClient({ adapter }).$extends({
    query: {
      async $allOperations({ operation, args, query }) {
        try {
          return await query(args);
        } catch (error) {
          if (!RETRYABLE_OPERATIONS.has(operation) || !isTransient(error)) throw error;
          console.warn(`[virallens] transient database error on ${operation}, retrying once:`, (error as Error).message.split("\n")[0]);
          return query(args);
        }
      },
    },
  }) as unknown as PrismaClient;

  globalForPrisma.__viralLensPrisma = client;
  return client;
}
