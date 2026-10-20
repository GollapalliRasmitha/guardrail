import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env } from "@/lib/env";
import * as schema from "./schema";

// One connection pool per server process, created the first time db() is called (not when the file is imported,
// so builds and unit tests don't need a database). In development Next.js reloads modules on every edit, so the
// pool is kept on globalThis; otherwise each reload would open new connections until Postgres refuses more.
const globalForDb = globalThis as unknown as {
  guardrailDb?: { pool: Pool; db: NodePgDatabase<typeof schema> };
};

function connect() {
  const url = env().DATABASE_URL;
  const isLocal = /@(localhost|127\.0\.0\.1)(:\d+)?\//.test(url);
  const pool = new Pool({
    connectionString: url,
    max: 5,
    // Neon needs TLS; the local Docker database doesn't have it.
    ssl: isLocal ? false : { rejectUnauthorized: true },
  });
  return { pool, db: drizzle(pool, { schema }) };
}

export function db() {
  return (globalForDb.guardrailDb ??= connect()).db;
}

export function pool() {
  return (globalForDb.guardrailDb ??= connect()).pool;
}

export { schema };
