import "dotenv/config";
import { defineConfig } from "prisma/config";
import { resolveDatabaseUrl } from "./lib/db/url";

// Prisma CLI config. The URL is built from DATABASE_URL or the DB_* parts.
// A placeholder keeps `prisma generate` working when no database is configured.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: resolveDatabaseUrl() ?? "mysql://user:password@localhost:3306/virallens",
    // Only needed by `prisma migrate dev` on hosts where the DB user cannot create databases (e.g. Hostinger).
    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL || undefined,
  },
});
