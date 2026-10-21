// Attack simulator: sends realistic attack traffic to YOUR LOCAL HomeHaat or Oppora, so GuardRail has something to
// catch. It refuses any address that isn't this computer (lib/simulator/target.ts). Never point it at the live sites.
//
//   npm run simulate                                   HomeHaat, all scenarios, http://localhost:8000 (its Django)
//   npm run simulate -- --scenario brute-force         one scenario
//   npm run simulate -- --site oppora                  Oppora, all scenarios, http://localhost:8000 (its Django)
//   npm run simulate -- --site oppora --target http://localhost:8002
//
// HomeHaat:  brute-force, stuffing, scan, flood, forged-webhook
// Oppora:    scan, flood, forged-callback, cron-guess   (Oppora signs in with Google only: there are no passwords)
//
// Fake attackers get IPs from documentation-only ranges (203.0.113.x…) and countries:
// - HomeHaat believes a forwarded IP only with its PROXY_SECRET, so the simulator reads that one value from
//   HomeHaat's local .env (never printed). Without it, every request comes from 127.0.0.1.
// - Oppora takes the visitor IP from X-Forwarded-For (its Next.js proxy adds it), so that header is enough locally.
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { assertLocalTarget, testNetIp } from "@/lib/simulator/target";

type Site = "homehaat" | "oppora";
type Scenario = {
  mitre: string;
  what: string;
  run: () => Promise<number[]>;
  note?: (statuses: number[]) => string | null;
};

const { values } = parseArgs({
  options: {
    site: { type: "string", default: "homehaat" },
    scenario: { type: "string", default: "all" },
    target: { type: "string", default: "http://localhost:8000" },
    "homehaat-env": { type: "string", default: "../homehaat/.env" },
  },
});

function refuse(message: string): never {
  console.error(message);
  process.exit(1);
}

if (values.site !== "homehaat" && values.site !== "oppora") refuse("--site must be homehaat or oppora");
const site = values.site as Site;
const siteName = site === "homehaat" ? "HomeHaat" : "Oppora";

let base: URL;
try {
  base = assertLocalTarget(values.target);
} catch (error) {
  refuse(error instanceof Error ? error.message : String(error));
}

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
const proxySecret = site === "homehaat" ? readProxySecret(values["homehaat-env"]) : null;
const fakeIps = site === "oppora" || Boolean(proxySecret);

const COUNTRIES = ["RU", "CN", "US", "BR", "NL", "VN", "DE", "NG"];
let attackerCount = 0;

/** A new fake attacker: an IP and a country, used for every request in one scenario. */
function attacker() {
  const n = attackerCount++;
  return {
    ip: fakeIps ? testNetIp(n + (site === "oppora" ? 40 : 7)) : "127.0.0.1",
    country: COUNTRIES[n % COUNTRIES.length]!,
  };
}
type Attacker = ReturnType<typeof attacker>;

/** The headers that make the site see the fake attacker's IP (each site has its own trusted way). */
function spoof(who: Attacker): Record<string, string> {
  if (site === "oppora") return { "X-Forwarded-For": who.ip };
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
    redirect: "manual", // never follow (e.g. to Google's sign-in page)
    headers: { "User-Agent": UA, ...spoof(init.who), ...(init.headers as Record<string, string>) },
  });
  await response.arrayBuffer(); // finish reading so the connection is freed
  return response.status;
}

/** Many requests, `parallel` at a time (8 = fast enough to trip rate limits, gentle on the dev server). */
async function burst(count: number, one: () => Promise<number>, parallel = 8): Promise<number[]> {
  const statuses: number[] = [];
  for (let i = 0; i < count; i += parallel) {
    statuses.push(...(await Promise.all(Array.from({ length: Math.min(parallel, count - i) }, one))));
  }
  return statuses;
}

const random = (bytes = 4) => randomBytes(bytes).toString("hex");

const SCANNER_PATHS = [
  "/wp-admin/",
  "/wp-login.php",
  "/.env",
  "/.git/config",
  "/phpmyadmin/",
  "/xmlrpc.php",
  "/server-status",
  "/vendor/phpunit/phpunit/src/Util/PHP/eval-stdin.php",
];

const scan: Scenario = {
  mitre: "T1595 Active Scanning",
  what: "one IP probes 8 paths scanners look for",
  run: async () => {
    const who = attacker();
    return Promise.all(SCANNER_PATHS.map((p) => call(p, { who, method: "GET" })));
  },
};

// ---- HomeHaat (email + password sign-in, Razorpay) ------------------------------------------------------------------

/** Django wants a CSRF cookie + matching header on sign-in, like the real website sends. */
async function homehaatCsrf(who: Attacker): Promise<{ cookie: string; token: string }> {
  const response = await fetch(new URL("/api/auth/csrf/", base), {
    headers: { "User-Agent": UA, ...spoof(who) },
  });
  const match = /homehaat_csrftoken=([^;]+)/.exec(response.headers.get("set-cookie") ?? "");
  if (!match)
    throw new Error("HomeHaat didn't give a CSRF cookie. Is HomeHaat running on " + base.origin + "?");
  return { cookie: `homehaat_csrftoken=${match[1]}`, token: match[1]! };
}

async function homehaatSignIn(who: Attacker, email: string, csrf?: { cookie: string; token: string }) {
  const { cookie, token } = csrf ?? (await homehaatCsrf(who));
  return call("/api/auth/signin/", {
    who,
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie, "X-CSRFToken": token },
    body: JSON.stringify({ email, password: `guess-${random()}` }),
  });
}

const HOMEHAAT: Record<string, Scenario> = {
  "brute-force": {
    mitre: "T1110 Brute Force",
    what: "12 wrong passwords for one account, from 3 IPs",
    run: async () => {
      const team = [attacker(), attacker(), attacker()];
      const statuses: number[] = [];
      for (let i = 0; i < 12; i++) statuses.push(await homehaatSignIn(team[i % 3]!, "victim@example.com"));
      return statuses;
    },
  },
  stuffing: {
    mitre: "T1110.004 Credential Stuffing",
    what: "one IP tries 8 different accounts (a leaked email/password list)",
    run: async () => {
      const who = attacker();
      const statuses: number[] = [];
      for (let i = 1; i <= 8; i++) statuses.push(await homehaatSignIn(who, `leaked-user${i}@example.com`));
      return statuses;
    },
  },
  scan,
  flood: {
    mitre: "T1499 Endpoint Denial of Service",
    what: "one IP sends 62 sign-in requests in a few seconds",
    run: async () => {
      const who = attacker();
      const csrf = await homehaatCsrf(who);
      return burst(62, () => homehaatSignIn(who, "flood@example.com", csrf));
    },
  },
  "forged-webhook": {
    mitre: "T1565 Data Manipulation",
    what: 'a fake Razorpay "payment captured" with a made-up signature',
    run: async () => {
      const body = JSON.stringify({
        event: "payment.captured",
        payload: {
          payment: { entity: { id: "pay_FAKE", order_id: "order_FAKE", amount: 100, status: "captured" } },
        },
      });
      const headers = { "Content-Type": "application/json", "X-Razorpay-Signature": random(32) };
      return [await call("/api/payments/webhook/", { who: attacker(), method: "POST", headers, body })];
    },
    note: (s) =>
      s[0] === 503
        ? "HomeHaat has no RAZORPAY_WEBHOOK_SECRET locally, so it can't check signatures and reports nothing.\n" +
          "  Run `npm run connect:homehaat` to give it a local one."
        : null,
  },
};

// ---- Oppora (Google sign-in only, a scheduler secret) ----------------------------------------------------------------

const OPPORA: Record<string, Scenario> = {
  scan,
  flood: {
    mitre: "T1499 Endpoint Denial of Service",
    what: "one IP opens the Google sign-in 75 times in a few seconds (the limit is 20 a minute)",
    run: async () => {
      const who = attacker();
      // One at a time: Oppora's limiter (DRF throttle on Redis) reads then writes its counter, so parallel requests
      // can slip past it (found by this simulator, 21 Oct 2026; see GuardRail CLAUDE.md). Sequential shows detection.
      return burst(75, () => call("/api/auth/google/login/", { who, method: "GET" }), 1);
    },
    note: () =>
      "Oppora answers a blocked sign-in with a redirect (302 to ?auth_error=rate_limited), not a 429.",
  },
  "forged-callback": {
    mitre: "(failed logins: no MITRE rule fires on these alone)",
    what: "6 fake Google sign-in callbacks with a forged state (login CSRF / replay attempts)",
    run: async () => {
      const who = attacker();
      const statuses: number[] = [];
      for (let i = 0; i < 6; i++) {
        statuses.push(
          await call(`/api/auth/google/callback/?state=forged-${random()}&code=x`, { who, method: "GET" }),
        );
      }
      return statuses;
    },
  },
  "cron-guess": {
    mitre: "(permission denied: no MITRE rule fires on these alone)",
    what: "5 guesses at the scheduler's secret (POST /api/cron/)",
    run: async () => {
      const who = attacker();
      return burst(5, () =>
        call("/api/cron/", { who, method: "POST", headers: { Authorization: `Bearer guess-${random(16)}` } }),
      );
    },
    note: (s) =>
      s.every((x) => x === 404)
        ? "Oppora has no CRON_SECRET locally, so /api/cron/ doesn't exist. Run `npm run connect:oppora` to set one."
        : null,
  },
};

const SCENARIOS = site === "homehaat" ? HOMEHAAT : OPPORA;
const chosen =
  values.scenario === "all"
    ? Object.keys(SCENARIOS)
    : values.scenario in SCENARIOS
      ? [values.scenario]
      : refuse(`--scenario for ${siteName} must be one of: all, ${Object.keys(SCENARIOS).join(", ")}`);

function summary(statuses: number[]): string {
  const counts = new Map<number, number>();
  for (const s of statuses) counts.set(s, (counts.get(s) ?? 0) + 1);
  return [...counts].map(([s, n]) => `${n}× ${s}`).join(", ");
}

async function main() {
  console.log(`Attacking LOCAL ${siteName} at ${base.origin}`);
  if (site === "homehaat") {
    console.log(
      proxySecret
        ? "Fake attacker IPs: on (HomeHaat's local PROXY_SECRET found)."
        : "Fake attacker IPs: off (no PROXY_SECRET in HomeHaat's .env), so everything comes from 127.0.0.1.",
    );
  }
  for (const name of chosen) {
    const scenario = SCENARIOS[name]!;
    try {
      const statuses = await scenario.run();
      console.log(
        `\n▸ ${name}  [${scenario.mitre}]\n  ${scenario.what}\n  ${siteName} answered: ${summary(statuses)}`,
      );
      const note = scenario.note?.(statuses);
      if (note) console.log(`  (${note})`);
    } catch (error) {
      refuse(
        `\n${name} failed: ${error instanceof Error ? error.message : error}\nIs ${siteName}'s Django running on ${base.origin}?`,
      );
    }
  }
  console.log("\nDone. Watch the events arrive on GuardRail's Events page.");
}

void main();
