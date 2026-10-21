// TEST VALUES ONLY, for the throwaway database guardrail_e2e on this computer. Never used for the real account.
export const E2E_PORT = 3101;
export const E2E_URL = `http://localhost:${E2E_PORT}`;
export const E2E_DATABASE_URL = "postgres://guardrail:guardrail@localhost:5434/guardrail_e2e";

export const E2E_ADMIN = {
  email: "e2e-admin@guardrail.test",
  password: "e2e-violet-lantern-harbour-77",
};

// Fixed test keys (32 bytes, base64) so every run of the e2e server behaves the same.
export const E2E_KEYS = {
  ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
  HASH_SECRET: Buffer.alloc(32, 9).toString("base64"),
  INGEST_SECRET_HOMEHAAT: "e2e-homehaat-signing-secret-0123456789abcdef",
  INGEST_SECRET_OPPORA: "e2e-oppora-signing-secret-0123456789abcdef",
  CRON_SECRET: "e2e-cron-secret-0123456789abcdef0123456789",
};
