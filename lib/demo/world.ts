import type { ChartBucket } from "@/components/charts/EventsChart";
import type { OverviewData } from "@/components/views/OverviewView";
import { SEVERITY_RANK, type AlertStatus } from "@/lib/alerts/types";
import { hourlyBuckets, IST_OFFSET_MS } from "@/lib/dashboard/buckets";
import type { AlertActivityRow, AlertRow } from "@/lib/db/schema";
import type { EventView } from "@/lib/events/filters";
import type { EventType, SourceId } from "@/lib/events/types";
import { analyzeEvents } from "@/lib/logs/analyze";
import { ATTACKER_COUNTRIES, DEMO_USERS, SCANNER_PATHS, seeded, type Random } from "./random";

// [KEY LOGIC] The public demo's world: one made-up day for both sites, generated from a fixed seed, with times
// counted back from "now". Its alerts are not hand-written: the generated events go through the SAME detection
// rules (via analyzeEvents, like an uploaded log). Nothing here touches the database, so the demo can never read
// real data or change anything.

const MIN = 60_000;
const HOUR = 60 * MIN;
const SEED = 2026;

type Draft = Omit<EventView, "id" | "occurredAt"> & { at: number };

const ADMIN = { actor: "ad****@example.com", ip: "198.51.100.4", country: "IN" };

/** Fake attacker n: a documentation IP and always the same country for it. */
function attacker(n: number) {
  return { ip: `203.0.113.${n}`, country: ATTACKER_COUNTRIES[n % ATTACKER_COUNTRIES.length]! };
}

function draft(source: SourceId, type: EventType, at: number, extra: Partial<Draft> = {}): Draft {
  const signIn = source === "homehaat" ? "/api/auth/signin/" : "/api/auth/google/callback/";
  return {
    source,
    type,
    at,
    ip: null,
    country: null,
    actor: null,
    path: signIn,
    method: "POST",
    statusCode: type === "login_failed" ? 401 : type === "rate_limited" ? 429 : 200,
    ...extra,
  };
}

/** A normal day: sign-ins, a few typos, payments, the odd bot. */
function background(rand: Random, now: number): Draft[] {
  const out: Draft[] = [];
  const when = () => now - rand.int(1, 24 * 60 - 1) * MIN - rand.int(0, 59) * 1000;
  for (const [source, logins, fails] of [
    ["homehaat", 170, 24],
    ["oppora", 120, 10],
  ] as const) {
    for (let i = 0; i < logins; i++) {
      const u = rand.pick(DEMO_USERS);
      out.push(draft(source, "login_success", when(), { ...u }));
    }
    for (let i = 0; i < fails; i++) {
      const u = rand.pick(DEMO_USERS);
      out.push(draft(source, "login_failed", when(), { ...u }));
    }
    for (let i = 0; i < 4; i++) {
      const u = rand.pick(DEMO_USERS);
      out.push(draft(source, "rate_limited", when(), { ip: u.ip, country: u.country }));
      out.push(
        draft(source, "permission_denied", when(), {
          ...u,
          path: "/api/admin/",
          method: "GET",
          statusCode: 403,
        }),
      );
    }
  }
  for (let i = 0; i < 8; i++) {
    const u = rand.pick(DEMO_USERS);
    out.push(draft("homehaat", "payment_failed", when(), { ...u, path: "/api/payments/verify/" }));
  }
  for (let i = 0; i < 5; i++) {
    out.push(draft("homehaat", "refund_issued", when(), { ...ADMIN, path: "/api/payments/refund/" }));
  }
  for (let i = 0; i < 6; i++) {
    out.push(draft("homehaat", "admin_login", now - (i * 3 + 4) * HOUR, { ...ADMIN, path: "/admin/login/" }));
  }
  for (const n of [31, 32, 33]) {
    out.push(
      draft(rand.pick(["homehaat", "oppora"] as const), "suspicious_path", when(), {
        ...attacker(n),
        path: rand.pick(SCANNER_PATHS),
        method: "GET",
        statusCode: 404,
      }),
    );
  }
  return out;
}

/** The six attacks the demo shows, each at a fixed time before "now". */
function attacks(rand: Random, now: number): Draft[] {
  const out: Draft[] = [];
  // T1110 brute force on one HomeHaat account, from 3 IPs.
  for (let i = 0; i < 14; i++) {
    out.push(
      draft("homehaat", "login_failed", now - 3 * HOUR + i * 15_000, {
        ...attacker(11 + (i % 3)),
        actor: "pr****@example.com",
      }),
    );
  }
  // T1110.004 credential stuffing: one IP, nine accounts.
  const stuffer = attacker(66);
  ["ar", "me", "ka", "sa", "jo", "ni", "de", "an", "ro"].forEach((who, i) =>
    out.push(
      draft("homehaat", "login_failed", now - 7 * HOUR + i * 9_000, {
        ...stuffer,
        actor: `${who}****@example.com`,
      }),
    ),
  );
  // T1595 scanning of Oppora.
  const scanner = attacker(23);
  SCANNER_PATHS.forEach((path, i) =>
    out.push(
      draft("oppora", "suspicious_path", now - 40 * MIN + i * 3_000, {
        ...scanner,
        path,
        method: "GET",
        statusCode: 404,
      }),
    ),
  );
  // T1499 request flood on Oppora's sign-in.
  const flooder = attacker(99);
  for (let i = 0; i < 60; i++)
    out.push(draft("oppora", "rate_limited", now - 5 * HOUR + i * 800, { ...flooder }));
  // T1565 forged payment webhooks at HomeHaat.
  const forger = attacker(140);
  for (let i = 0; i < 2; i++) {
    out.push(
      draft("homehaat", "webhook_signature_failed", now - 10 * HOUR + i * 60_000, {
        ...forger,
        path: "/api/payments/webhook/",
        statusCode: 400,
      }),
    );
  }
  // T1078 the admin signs in from an IP never seen before.
  out.push(
    draft("homehaat", "admin_login", now - 2 * HOUR, {
      ...ADMIN,
      ...attacker(201),
      path: "/admin/login/",
    }),
  );
  return out;
}

/** Older attacks are already handled; the newest ones are still waiting for you. */
function statusFor(lastSeenAgo: number): AlertStatus {
  if (lastSeenAgo > 6 * HOUR) return "resolved";
  if (lastSeenAgo > 2.5 * HOUR) return "acknowledged";
  return "open";
}

const NOTES: Partial<Record<string, string>> = {
  brute_force: "Asked the account owner to change their password; no successful sign-in from these IPs.",
  forged_webhook: "Razorpay dashboard shows no matching payment. Signature check did its job.",
  flood: "Rate limit held; the site stayed fast. Nothing else to do.",
};

export function demoWorld(nowDate = new Date()) {
  const now = nowDate.getTime();
  const rand = seeded(SEED);
  const drafts = [...background(rand, now), ...attacks(rand, now)].sort((a, b) => a.at - b.at);
  const events: EventView[] = drafts.map(({ at, ...e }, i) => ({
    ...e,
    id: i + 1,
    occurredAt: new Date(at).toISOString(),
  }));
  const byId = new Map(events.map((e) => [e.id, e]));

  // The real rules, run on the fake events (one source at a time, like the live engine's per-site events).
  const findings = (["homehaat", "oppora"] as const).flatMap((source) =>
    analyzeEvents(
      events
        .filter((e) => e.source === source)
        .map((e) => ({ ...e, line: e.id, occurredAt: new Date(e.occurredAt) })),
      source,
    ).map((f) => ({ ...f, source })),
  );
  findings.sort((a, b) => b.lastSeen.getTime() - a.lastSeen.getTime());

  const alerts: AlertRow[] = [];
  const activity = new Map<number, AlertActivityRow[]>();
  findings.forEach((f, i) => {
    const id = i + 1;
    const status = statusFor(now - f.lastSeen.getTime());
    const at = (ms: number) => new Date(Math.min(now, ms));
    alerts.push({
      id,
      ruleId: f.ruleId,
      groupKey: `${f.ruleId}:demo:${id}`,
      source: f.source,
      severity: f.severity,
      status,
      title: f.title,
      subject: f.subject,
      eventCount: f.events,
      firstSeen: f.firstSeen,
      lastSeen: f.lastSeen,
      resolvedAt: status === "resolved" ? at(f.lastSeen.getTime() + 40 * MIN) : null,
      emailedAt: null,
      createdAt: f.firstSeen,
      updatedAt: f.lastSeen,
    });

    let n = 0;
    const row = (
      kind: AlertActivityRow["kind"],
      time: Date,
      detail: AlertActivityRow["detail"],
      note: string | null = null,
    ) =>
      ({ id: id * 100 + n++, alertId: id, kind, detail, note, createdAt: time }) satisfies AlertActivityRow;
    const first = Math.min(f.events, f.ruleId === "flood" ? 50 : f.ruleId === "brute_force" ? 10 : 1);
    const rows = [row("created", f.firstSeen, { severity: f.severity, events: first })];
    if (f.events > first)
      rows.push(row("events", f.lastSeen, { added: f.events - first, until: f.lastSeen.toISOString() }));
    if (SEVERITY_RANK[f.severity] === 3) rows.push(row("email_sent", at(f.firstSeen.getTime() + 2_000), {}));
    if (status !== "open")
      rows.push(row("status", at(f.lastSeen.getTime() + 10 * MIN), { from: "open", to: "acknowledged" }));
    const note = NOTES[f.ruleId];
    if (status !== "open" && note) rows.push(row("note", at(f.lastSeen.getTime() + 25 * MIN), {}, note));
    if (status === "resolved")
      rows.push(row("status", at(f.lastSeen.getTime() + 40 * MIN), { from: "acknowledged", to: "resolved" }));
    activity.set(id, rows);
  });
  const evidence = new Map(
    findings.map((f, i) => [i + 1, f.lines.map((line) => byId.get(line)!).reverse()]), // newest first
  );

  // Overview numbers, computed from the same events.
  const hourRows = new Map<string, { hour: Date; source: SourceId; n: number }>();
  const ipCounts = new Map<string, { ipHash: string; ip: string; country: string | null; n: number }>();
  for (const e of events) {
    const t = new Date(e.occurredAt).getTime();
    const hour = new Date(Math.floor((t + IST_OFFSET_MS) / HOUR) * HOUR - IST_OFFSET_MS);
    const key = `${hour.getTime()}:${e.source}`;
    const r = hourRows.get(key) ?? { hour, source: e.source, n: 0 };
    r.n += 1;
    hourRows.set(key, r);
    if (e.ip) {
      const c = ipCounts.get(e.ip) ?? { ipHash: e.ip, ip: e.ip, country: e.country, n: 0 };
      c.n += 1;
      ipCounts.set(e.ip, c);
    }
  }
  const buckets: ChartBucket[] = hourlyBuckets([...hourRows.values()], nowDate, IST_OFFSET_MS).map((b) => ({
    ...b,
    start: b.start.toISOString(),
  }));
  const active = alerts.filter((a) => a.status !== "resolved");
  const lastOf = (source: SourceId) => new Date(events.findLast((e) => e.source === source)!.occurredAt);
  const overview: OverviewData = {
    stats: {
      events24h: events.length,
      sourcesOnline: 2,
      failedSignIns24h: 0,
      sources: {
        homehaat: { lastSeen: lastOf("homehaat"), online: true },
        oppora: { lastSeen: lastOf("oppora"), online: true },
      },
    },
    latest: events.slice(-8).reverse(),
    alertCounts: {
      high: active.filter((a) => a.severity === "high").length,
      medium: active.filter((a) => a.severity === "medium").length,
      low: active.filter((a) => a.severity === "low").length,
      total: active.length,
    },
    alerts: active.slice(0, 5),
    buckets,
    ips: [...ipCounts.values()].sort((a, b) => b.n - a.n).slice(0, 5),
  };

  return {
    events,
    alerts,
    overview,
    activity: (id: number) => activity.get(id) ?? [],
    evidence: (id: number) => evidence.get(id) ?? [],
  };
}
