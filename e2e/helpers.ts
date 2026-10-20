// Shared end-to-end helpers. Everything here talks to the THROWAWAY database and the :3101 test server only.
import { randomBytes } from "node:crypto";
import { expect, type APIRequestContext, type Page } from "@playwright/test";
import { Pool } from "pg";
import { base32Decode, currentStep, hotp } from "../lib/auth/totp";
import { decryptWithKey } from "../lib/crypto";
import { signRequest } from "../lib/ingest/signature";
import { assertThrowaway } from "../lib/safety";
import { E2E_ADMIN, E2E_DATABASE_URL, E2E_KEYS } from "./fixtures";

assertThrowaway(E2E_DATABASE_URL);
export const e2eDb = new Pool({ connectionString: E2E_DATABASE_URL, max: 2 });

/**
 * Sign in as the test admin (2FA was set up by 01-auth.spec.ts). The test reads the 2FA secret from the throwaway
 * database, like a phone would have it, and uses a code for a step the server hasn't accepted yet.
 */
export async function signInAsAdmin(page: Page) {
  await page.goto("/signin");
  await page.getByLabel("Email").fill(E2E_ADMIN.email);
  await page.getByLabel("Password", { exact: true }).fill(E2E_ADMIN.password);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByLabel("6-digit code")).toBeVisible();

  const { rows } = await e2eDb.query<{ enc: string; last: string }>(
    "SELECT totp_secret_enc AS enc, totp_last_step AS last FROM admin_user LIMIT 1",
  );
  const secret = decryptWithKey(Buffer.from(E2E_KEYS.ENCRYPTION_KEY, "base64"), rows[0]!.enc);
  const lastUsed = Number(rows[0]!.last);
  let step: number | undefined;
  for (;;) {
    const now = currentStep(Date.now());
    step = [now, now + 1].find((s) => s > lastUsed); // current or next step, never one already used
    if (step !== undefined) break;
    await page.waitForTimeout(1000);
  }
  await page.getByLabel("6-digit code").fill(hotp(base32Decode(secret), step));
  await page.getByRole("button", { name: "Verify and sign in" }).click();
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
}

type Source = "homehaat" | "oppora";

/** Send events to /api/ingest signed exactly like HomeHaat/Oppora will. Options make deliberately bad requests. */
export async function sendSigned(
  request: APIRequestContext,
  events: unknown[] | string,
  options: { source?: Source; signAs?: Source | "wrong"; timestamp?: number; nonce?: string } = {},
) {
  const source = options.source ?? "homehaat";
  const signAs = options.signAs ?? source;
  const secret =
    signAs === "wrong"
      ? "definitely-not-the-right-secret-0000000000"
      : E2E_KEYS[signAs === "homehaat" ? "INGEST_SECRET_HOMEHAAT" : "INGEST_SECRET_OPPORA"];
  const body = typeof events === "string" ? events : JSON.stringify({ events });
  const timestamp = options.timestamp ?? Math.floor(Date.now() / 1000);
  const nonce = options.nonce ?? randomBytes(16).toString("hex");
  const response = await request.post("/api/ingest", {
    headers: {
      "Content-Type": "application/json",
      "X-GuardRail-Source": source,
      "X-GuardRail-Timestamp": String(timestamp),
      "X-GuardRail-Nonce": nonce,
      "X-GuardRail-Signature": signRequest(secret, timestamp, nonce, body),
    },
    data: Buffer.from(body), // raw bytes: exactly what was signed (a string could be re-encoded)
  });
  return { response, nonce, timestamp, body };
}

export function testEvent(overrides: Record<string, unknown> = {}) {
  return {
    type: "login_failed",
    occurred_at: new Date().toISOString(),
    ip: "203.0.113.10",
    actor: "someone@example.com",
    path: "/api/auth/signin/",
    method: "POST",
    status_code: 401,
    ...overrides,
  };
}
