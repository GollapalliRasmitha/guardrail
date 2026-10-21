import { defineConfig, devices } from "@playwright/test";
import { E2E_DATABASE_URL, E2E_KEYS, E2E_PORT, E2E_URL } from "./e2e/fixtures";

// End-to-end tests run a SEPARATE copy of GuardRail on port 3101 with the throwaway database guardrail_e2e,
// so your normal app (port 3100) and its data are never touched. Needs Docker Postgres running.
export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1, // the tests share one account, so they run in order
  retries: 0,
  reporter: [["list"]],
  timeout: 60_000,
  globalTimeout: 10 * 60_000, // a stuck run fails after 10 minutes instead of hanging
  use: {
    baseURL: E2E_URL,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npx next dev -p ${E2E_PORT}`,
    url: `${E2E_URL}/api/health`,
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      NEXT_DIST_DIR: ".next-e2e",
      DATABASE_URL: E2E_DATABASE_URL,
      APP_URL: E2E_URL,
      ...E2E_KEYS,
    },
  },
});
