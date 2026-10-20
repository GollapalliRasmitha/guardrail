import { defineConfig } from "drizzle-kit";

// Only used by `npm run db:generate`, which writes SQL migration files into ./drizzle (committed to git).
// Applying them is done by scripts/migrate.ts.
export default defineConfig({
  dialect: "postgresql",
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  strict: true,
});
