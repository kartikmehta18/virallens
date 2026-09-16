export interface DbConnectionParts {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

/** Reads DB connection parts from DB_* vars, or parses DATABASE_URL. Returns null when no DB is configured. */
export function resolveDbParts(): DbConnectionParts | null {
  const { DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME, DATABASE_URL } = process.env;

  if (DB_HOST && DB_USER && DB_NAME) {
    return {
      host: DB_HOST,
      port: Number(DB_PORT) || 3306,
      user: DB_USER,
      password: DB_PASSWORD ?? "",
      database: DB_NAME,
    };
  }

  if (DATABASE_URL && /^(mysql|mariadb):\/\//.test(DATABASE_URL)) {
    try {
      const url = new URL(DATABASE_URL);
      return {
        host: url.hostname,
        port: Number(url.port) || 3306,
        user: decodeURIComponent(url.username),
        password: decodeURIComponent(url.password),
        database: url.pathname.replace(/^\//, ""),
      };
    } catch {
      return null;
    }
  }

  return null;
}

export function resolveDatabaseUrl(): string | null {
  const parts = resolveDbParts();
  if (!parts) return null;
  const auth = `${encodeURIComponent(parts.user)}:${encodeURIComponent(parts.password)}`;
  return `mysql://${auth}@${parts.host}:${parts.port}/${parts.database}`;
}
