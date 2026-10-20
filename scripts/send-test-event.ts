// Sends signed test events to YOUR LOCAL GuardRail, exactly like HomeHaat/Oppora will. Examples:
//   npm run send-test-event                                   one failed login from HomeHaat
//   npm run send-test-event -- --type suspicious_path --count 5
//   npm run send-test-event -- --source oppora
//   npm run send-test-event -- --replay          send the same signed request twice (2nd must be refused)
//   npm run send-test-event -- --bad-signature   wrong secret (must be refused)
//   npm run send-test-event -- --stale           10-minute-old timestamp (must be refused)
// It refuses any address that isn't this computer. Test IPs come from ranges reserved for documentation.
import { randomBytes } from "node:crypto";
import { parseArgs } from "node:util";
import { EVENT_TYPES, SOURCES, type EventType, type SourceId } from "@/lib/events/types";
import { signRequest } from "@/lib/ingest/signature";

const { values } = parseArgs({
  options: {
    source: { type: "string", default: "homehaat" },
    type: { type: "string", default: "login_failed" },
    count: { type: "string", default: "1" },
    replay: { type: "boolean", default: false },
    "bad-signature": { type: "boolean", default: false },
    stale: { type: "boolean", default: false },
  },
});

/** Stop with a plain message (no stack trace) when the input or setup is wrong. */
function refuse(message: string): never {
  console.error(message);
  process.exit(1);
}

const source = values.source as SourceId;
const type = values.type as EventType;
if (!SOURCES.includes(source)) refuse(`--source must be one of: ${SOURCES.join(", ")}`);
if (!EVENT_TYPES.includes(type)) refuse(`--type must be one of: ${EVENT_TYPES.join(", ")}`);
const count = Math.min(50, Math.max(1, Number(values.count) || 1));

const appUrl = new URL(process.env.APP_URL ?? "http://localhost:3100");
if (!["localhost", "127.0.0.1"].includes(appUrl.hostname)) {
  refuse(`Refusing: ${appUrl.host} is not this computer. Test events only go to a local GuardRail.`);
}
const secret = process.env[source === "homehaat" ? "INGEST_SECRET_HOMEHAAT" : "INGEST_SECRET_OPPORA"] ?? "";
if (!secret) refuse(`The ${source} secret isn't set in .env. Run start-guardrail.ps1 once to add it.`);

const PATHS: Partial<Record<EventType, string>> = {
  suspicious_path: "/wp-admin/setup-config.php",
  webhook_signature_failed: "/api/payments/webhook/",
  rate_limited: "/api/auth/signin/",
  permission_denied: "/api/seller/orders/",
};

function testEvent(i: number) {
  return {
    type,
    occurred_at: new Date().toISOString(),
    ip: `203.0.113.${(i % 250) + 1}`, // TEST-NET-3: never a real person's address
    actor: type.includes("login") || type.startsWith("password") ? `test-user${i}@example.com` : undefined,
    path: PATHS[type] ?? "/api/auth/signin/",
    method: type === "suspicious_path" ? "GET" : "POST",
    status_code: type === "suspicious_path" ? 404 : type === "rate_limited" ? 429 : 401,
    user_agent: "guardrail-send-test-event",
    country: "IN",
    meta: { reason: "test" },
  };
}

async function send(body: string, timestamp: number, nonce: string, signWith: string) {
  const response = await fetch(new URL("/api/ingest", appUrl), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-GuardRail-Source": source,
      "X-GuardRail-Timestamp": String(timestamp),
      "X-GuardRail-Nonce": nonce,
      "X-GuardRail-Signature": signRequest(signWith, timestamp, nonce, body),
    },
    body,
  });
  return `${response.status} ${await response.text()}`;
}

async function main() {
  const body = JSON.stringify({ events: Array.from({ length: count }, (_, i) => testEvent(i)) });
  const timestamp = Math.floor(Date.now() / 1000) - (values.stale ? 600 : 0);
  const nonce = randomBytes(16).toString("hex");
  const signWith = values["bad-signature"] ? "not-the-real-secret-not-the-real-secret" : secret;

  console.log(`Sending ${count} × ${type} from ${source} to ${appUrl.origin}/api/ingest`);
  console.log("→", await send(body, timestamp, nonce, signWith));
  if (values.replay) console.log("→ replay:", await send(body, timestamp, nonce, signWith));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
