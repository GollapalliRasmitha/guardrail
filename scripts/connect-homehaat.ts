// Connects your LOCAL HomeHaat to your LOCAL GuardRail by writing a few settings into HomeHaat's .env.
// Run once: npm run connect:homehaat        (then restart HomeHaat)
//
// - GUARDRAIL_ENABLED=true, GUARDRAIL_URL=http://localhost:3100 (only if not set yet)
// - GUARDRAIL_SECRET = the same value as INGEST_SECRET_HOMEHAAT in this project's .env (kept in sync)
// - PROXY_SECRET, RAZORPAY_WEBHOOK_SECRET: a random local value, only if empty (lets HomeHaat trust the simulator's
//   fake IPs and check webhook signatures locally; Razorpay can't reach localhost anyway)
// Values are copied file to file and never printed. Only these lines change; everything else stays as it is.
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: { "homehaat-env": { type: "string", default: "../homehaat/.env" } },
});
const target = values["homehaat-env"];

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

const secret = process.env.INGEST_SECRET_HOMEHAAT ?? "";
if (secret.length < 32)
  fail("INGEST_SECRET_HOMEHAAT isn't set in guardrail/.env. Run start-guardrail.ps1 once first.");
if (!existsSync(target))
  fail(`Can't find ${target}. Start HomeHaat once (it creates its .env), or pass --homehaat-env.`);

const lines = readFileSync(target, "utf8").split(/\r?\n/);
const current = (name: string) =>
  lines
    .find((l) => l.startsWith(`${name}=`))
    ?.slice(name.length + 1)
    .trim() ?? "";
const changes: string[] = [];

function set(name: string, value: string, when: "if-empty" | "always") {
  const old = current(name);
  if (when === "if-empty" && old) return;
  if (old === value) return;
  const index = lines.findIndex((l) => l.startsWith(`${name}=`));
  if (index >= 0) lines[index] = `${name}=${value}`;
  else lines.push(`${name}=${value}`);
  changes.push(name);
}

const random = () => randomBytes(32).toString("base64url");
set("GUARDRAIL_ENABLED", "true", "if-empty");
set("GUARDRAIL_URL", "http://localhost:3100", "if-empty");
set("GUARDRAIL_SECRET", secret, "always");
set("PROXY_SECRET", random(), "if-empty");
set("RAZORPAY_WEBHOOK_SECRET", random(), "if-empty");

if (changes.length === 0) {
  console.log("HomeHaat's .env is already connected. Nothing changed.");
} else {
  writeFileSync(target, lines.join("\n").replace(/\n*$/, "\n"));
  console.log(
    `Updated HomeHaat's .env: ${changes.join(", ")} (values not shown). Restart HomeHaat to use them.`,
  );
}
