// Run before any command that deletes data:  npm run throwaway-check && <the delete command>
// Exits with an error unless DATABASE_URL is the local throwaway database guardrail_e2e.
import { assertThrowaway } from "@/lib/safety";

try {
  assertThrowaway(process.env.DATABASE_URL);
  console.log("OK: DATABASE_URL is the throwaway database.");
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
