// Attack simulator: sends realistic attack traffic to YOUR LOCAL HomeHaat, so GuardRail has something to catch.
// It refuses any address that isn't this computer (lib/simulator/target.ts). Never point it at the live sites.
//
//   npm run simulate                              all scenarios against http://localhost:8000 (HomeHaat's Django)
//   npm run simulate -- --scenario brute-force    one scenario: brute-force, stuffing, scan, flood, forged-webhook
//   npm run simulate -- --target http://localhost:8000 --homehaat-env ../homehaat/.env
//
// Different attackers get different fake IPs from documentation-only ranges (203.0.113.x…) and countries. HomeHaat
// only believes a forwarded IP when it carries its PROXY_SECRET, so the simulator reads that one value from
// HomeHaat's local .env (`npm run connect:homehaat` sets a local one). Without it, every request comes from 127.0.0.1.
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { assertLocalTarget, testNetIp } from "@/lib/simulator/target";

const SCENARIOS = ["brute-force", "stuffing", "scan", "flood", "forged-webhook"] as const;
type Scenario = (typeof SCENARIOS)[number];

const { values } = parseArgs({
  options: {
    scenario: { type: "string", default: "all" },
    target: { type: "string", default: "http://localhost:8000" },
    "homehaat-env": { type: "string", default: "../homehaat/.env" },
  },
});

function refuse(message: string): never {
  console.error(message);
  process.exit(1);
}

let base: URL;
try {
  base = assertLocalTarget(values.target);
} catch (error) {
  refuse(error instanceof Error ? error.message : String(error));
}
const chosen: Scenario[] =
  values.scenario === "all"
    ? [...SCENARIOS]
    : SCENARIOS.includes(values.scenario as Scenario)
      ? [values.scenario as Scenario]
      : refuse(`--scenario must be one of: all, ${SCENARIOS.join(", ")}`);

/** Only the PROXY_SECRET line is read from HomeHaat's .env; nothing is printed. */
function readProxySecret(path: string): string | null {
  try {
    const line = readFileSync(path, "utf8")
      .split(/\r?\n/)
      .find((l) => l.startsWith("PROXY_SECRET="));
    return line?.slice("PROXY_SECRET=".length).trim() || null;
  } catch {
    return null;
  }
}
const proxySecret = readProxySecret(values["homehaat-env"]);

const COUNTRIES = ["RU", "CN", "US", "BR", "NL", "VN", "DE", "NG"];
let attackerCount = 0;

/** A new fake attacker: an IP and a country, used for every request in one scenario. */
function attacker() {
  const n = attackerCount++;
  return { ip: proxySecret ? testNetIp(n + 7) : "127.0.0.1", country: COUNTRIES[n % COUNTRIES.length]! };
}

type Attacker = ReturnType<typeof attacker>;

function spoof(who: Attacker): Record<string, string> {
  if (!proxySecret) return {};
  return {
    "X-HomeHaat-Proxy-Secret": proxySecret,
    "X-HomeHaat-Client-IP": who.ip,
    "X-HomeHaat-Client-Country": who.country,
  };
}

const UA = "guardrail-attack-simulator (local test)";

async function call(path: string, init: RequestInit & { who: Attacker }): Promise<number> {
  const response = await fetch(new URL(path, base), {
    ...init,
    redirect: "manual",
    headers: { "User-Agent": UA, ...spoof(init.who), ...(init.headers as Record<string, string>) },
  });
  await response.arrayBuffer(); // finish reading so the connection is freed
  return response.status;
}

/** Django wants a CSRF cookie + matching header on sign-in, like the real website sends. */
async function csrf(who: Attacker): Promise<{ cookie: string; token: string }> {
  const response = await fetch(new URL("/api/auth/csrf/", base), {
    headers: { "User-Agent": UA, ...spoof(who) },
  });
  const match = /homehaat_csrftoken=([^;]+)/.exec(response.headers.get("set-cookie") ?? "");
  if (!match) throw new Error("HomeHaat didn't give a CSRF cookie. Is it running on " + base.origin + "?");
  return { cookie: `homehaat_csrftoken=${match[1]}`, token: match[1]! };
}

async function signIn(who: Attacker, email: string, password: string): Promise<number> {
  const { cookie, token } = await csrf(who);
  return call("/api/auth/signin/", {
    who,
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie, "X-CSRFToken": token },
    body: JSON.stringify({ email, password }),
  });
}

const guess = () => `guess-${randomBytes(4).toString("hex")}`;

const RUN: Record<Scenario, { mitre: string; what: string; run: () => Promise<number[]> }> = {
  "brute-force": {
    mitre: "T1110 Brute Force",
    what: "12 wrong passwords for one account, from 3 IPs",
    run: async () => {
      const statuses: number[] = [];
      const team = [attacker(), attacker(), attacker()];
      for (let i = 0; i < 12; i++) statuses.push(await signIn(team[i % 3]!, "victim@example.com", guess()));
      return statuses;
    },
  },
  stuffing: {
    mitre: "T1110.004 Credential Stuffing",
    what: "one IP tries 8 different accounts (a leaked email/password list)",
    run: async () => {
      const who = attacker();
      const statuses: number[] = [];
      for (let i = 1; i <= 8; i++) statuses.push(await signIn(who, `leaked-user${i}@example.com`, guess()));
      return statuses;
    },
  },
  scan: {
    mitre: "T1595 Active Scanning",
    what: "one IP probes 8 paths scanners look for",
    run: async () => {
      const who = attacker();
      const paths = [
        "/wp-admin/",
        "/wp-login.php",
        "/.env",
        "/.git/config",
        "/phpmyadmin/",
        "/xmlrpc.php",
        "/server-status",
        "/vendor/phpunit/phpunit/src/Util/PHP/eval-stdin.php",
      ];
      return Promise.all(paths.map((p) => call(p, { who, method: "GET" })));
    },
  },
  flood: {
    mitre: "T1499 Endpoint Denial of Service",
    what: "one IP sends 62 sign-in requests in a few seconds",
    run: async () => {
      const who = attacker();
      const { cookie, token } = await csrf(who);
      const one = () =>
        call("/api/auth/signin/", {
          who,
          method: "POST",
          headers: { "Content-Type": "application/json", Cookie: cookie, "X-CSRFToken": token },
          body: JSON.stringify({ email: "flood@example.com", password: guess() }),
        });
      const statuses: number[] = [];
      for (let i = 0; i < 62; i += 8)
        statuses.push(...(await Promise.all(Array.from({ length: Math.min(8, 62 - i) }, one))));
      return statuses;
    },
  },
  "forged-webhook": {
    mitre: "T1565 Data Manipulation",
    what: 'a fake Razorpay "payment captured" with a made-up signature',
    run: async () => {
      const who = attacker();
      const body = JSON.stringify({
        event: "payment.captured",
        payload: {
          payment: { entity: { id: "pay_FAKE", order_id: "order_FAKE", amount: 100, status: "captured" } },
        },
      });
      return [
        await call("/api/payments/webhook/", {
          who,
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Razorpay-Signature": randomBytes(32).toString("hex"),
          },
          body,
        }),
      ];
    },
  },
};

function summary(statuses: number[]): string {
  const counts = new Map<number, number>();
  for (const s of statuses) counts.set(s, (counts.get(s) ?? 0) + 1);
  return [...counts].map(([s, n]) => `${n}× ${s}`).join(", ");
}

async function main() {
  console.log(`Attacking LOCAL HomeHaat at ${base.origin}`);
  console.log(
    proxySecret
      ? "Fake attacker IPs: on (HomeHaat's local PROXY_SECRET found)."
      : "Fake attacker IPs: off (no PROXY_SECRET in HomeHaat's .env), so everything comes from 127.0.0.1.",
  );
  for (const name of chosen) {
    const scenario = RUN[name];
    try {
      const statuses = await scenario.run();
      console.log(
        `\n▸ ${name}  [${scenario.mitre}]\n  ${scenario.what}\n  HomeHaat answered: ${summary(statuses)}`,
      );
      if (name === "forged-webhook" && statuses[0] === 503) {
        console.log(
          "  (HomeHaat has no RAZORPAY_WEBHOOK_SECRET locally, so it can't check signatures and reports nothing.",
        );
        console.log("   Run `npm run connect:homehaat` to give it a local one.)");
      }
    } catch (error) {
      refuse(
        `\n${name} failed: ${error instanceof Error ? error.message : error}\nIs HomeHaat's Django running on ${base.origin}?`,
      );
    }
  }
  console.log("\nDone. Watch the events arrive on GuardRail's Events page.");
}

void main();
