// Connects your LOCAL HomeHaat or Oppora to your LOCAL GuardRail by writing a few settings into that site's .env.
//   npm run connect:homehaat        (then restart HomeHaat)
//   npm run connect:oppora          (then restart Oppora)
//
// Both: GUARDRAIL_ENABLED=true and GUARDRAIL_URL=http://localhost:3100 (only if not set yet), and GUARDRAIL_SECRET =
//       the same value as that site's INGEST_SECRET_* in this project's .env (kept in sync).
// HomeHaat also: PROXY_SECRET, RAZORPAY_WEBHOOK_SECRET   } a random local value, only if empty: lets the site trust the
// Oppora also:   CRON_SECRET                              } simulator's fake IPs / check signatures / guard its scheduler
// Values are copied file to file and never printed. Only these lines change; everything else stays as it is.
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";

const SITES = {
  homehaat: {
    name: "HomeHaat",
    env: "../homehaat/.env",
    secret: "INGEST_SECRET_HOMEHAAT",
    localRandom: ["PROXY_SECRET", "RAZORPAY_WEBHOOK_SECRET"],
  },
  oppora: {
    name: "Oppora",
    env: "../Oppora/.env",
    secret: "INGEST_SECRET_OPPORA",
    localRandom: ["CRON_SECRET"],
  },
} as const;

const { values } = parseArgs({ options: { site: { type: "string" }, env: { type: "string" } } });

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

if (values.site !== "homehaat" && values.site !== "oppora") fail("Use --site homehaat or --site oppora.");
const site = SITES[values.site];
const target = values.env ?? site.env;

const secret = process.env[site.secret] ?? "";
if (secret.length < 32)
  fail(`${site.secret} isn't set in guardrail/.env. Run start-guardrail.ps1 once first.`);
if (!existsSync(target))
  fail(`Can't find ${target}. Start ${site.name} once (it creates its .env), or pass --env.`);

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

set("GUARDRAIL_ENABLED", "true", "if-empty");
set("GUARDRAIL_URL", "http://localhost:3100", "if-empty");
set("GUARDRAIL_SECRET", secret, "always");
for (const name of site.localRandom) set(name, randomBytes(32).toString("base64url"), "if-empty");

if (changes.length === 0) {
  console.log(`${site.name}'s .env is already connected. Nothing changed.`);
} else {
  writeFileSync(target, lines.join("\n").replace(/\n*$/, "\n"));
  console.log(
    `Updated ${site.name}'s .env: ${changes.join(", ")} (values not shown). Restart ${site.name} to use them.`,
  );
}
