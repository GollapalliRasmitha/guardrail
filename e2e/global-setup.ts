// Runs once before the end-to-end tests: resets the THROWAWAY database and creates the test account.
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { hashPassword } from "../lib/auth/password";
import { adminUser } from "../lib/db/schema";
import { assertThrowaway } from "../lib/safety";
import { E2E_ADMIN, E2E_DATABASE_URL, E2E_URL } from "./fixtures";

export default async function globalSetup() {
  assertThrowaway(E2E_DATABASE_URL); // safety rule: refuse unless this is guardrail_e2e on localhost
  const pool = new Pool({ connectionString: E2E_DATABASE_URL });
  try {
    const db = drizzle(pool);
    await migrate(db, { migrationsFolder: "./drizzle" });
    await pool.query(
      "TRUNCATE alert_activity, alert_event, alert, event, ingest_nonce, auth_attempt, session, admin_user RESTART IDENTITY CASCADE",
    );
    await db
      .insert(adminUser)
      .values({ email: E2E_ADMIN.email, passwordHash: await hashPassword(E2E_ADMIN.password) });
  } finally {
    await pool.end();
  }

  // Warm-up: the dev server compiles each page on its first visit, which can take seconds. Visiting them now
  // keeps that delay out of timed steps (like typing a 2FA code that expires every 30 seconds).
  const paths = ["/signin", "/setup-2fa", "/dashboard", "/dashboard/events", "/dashboard/settings"];
  const apis = [
    "/api/auth/signin",
    "/api/auth/2fa/setup",
    "/api/auth/2fa/setup/confirm",
    "/api/auth/2fa/verify",
  ];
  for (const path of [...paths, ...apis, "/api/ingest", "/api/stream", "/api/events"]) {
    await fetch(E2E_URL + path, { redirect: "manual" }).catch(() => undefined);
  }
}
