// Applies the SQL migrations in ./drizzle to DATABASE_URL. Safe to run again: done migrations are skipped.
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db, pool } from "@/lib/db";

async function main() {
  await migrate(db(), { migrationsFolder: "./drizzle" });
  console.log("Database is up to date.");
}

main()
  .catch((error: unknown) => {
    console.error("Migration failed:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => pool().end());
