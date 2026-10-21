import { expect, test } from "@playwright/test";
import { E2E_KEYS } from "./fixtures";
import { e2eDb } from "./helpers";

// The daily clean-up: raw IPs older than 30 days are wiped (their keyed hash stays), and so is the IP in old alerts.
test("the clean-up wipes IPs older than 30 days and refuses a wrong secret", async ({ request }) => {
  const old = "now() - interval '31 days'";
  const { rows } = await e2eDb.query<{ id: string }>(
    `INSERT INTO event (source, type, occurred_at, received_at, ip, ip_hash) VALUES
       ('homehaat', 'suspicious_path', ${old}, ${old}, '203.0.113.31', 'hash-old'),
       ('homehaat', 'suspicious_path', now(), now(), '203.0.113.32', 'hash-new')
     RETURNING id`,
  );
  const { rows: alerts } = await e2eDb.query<{ id: string }>(
    `INSERT INTO alert (rule_id, group_key, source, severity, status, title, subject, event_count, first_seen, last_seen)
     VALUES ('scanning', 'scanning:ip:hash-old', 'homehaat', 'low', 'resolved', 'Scanning from 203.0.113.31',
             '203.0.113.31', 1, ${old}, ${old})
     RETURNING id`,
  );

  expect((await request.get("/api/cron/retention")).status()).toBe(401);
  const wrong = await request.get("/api/cron/retention", { headers: { Authorization: "Bearer nope" } });
  expect(wrong.status()).toBe(401);

  const ok = await request.get("/api/cron/retention", {
    headers: { Authorization: `Bearer ${E2E_KEYS.CRON_SECRET}` },
  });
  expect(ok.status()).toBe(200);
  expect((await ok.json()).ipsWiped).toBeGreaterThanOrEqual(1);

  const { rows: after } = await e2eDb.query<{ ip: string | null; ip_hash: string }>(
    "SELECT host(ip) AS ip, ip_hash FROM event WHERE id = ANY($1) ORDER BY id",
    [rows.map((r) => r.id)],
  );
  expect(after).toEqual([
    { ip: null, ip_hash: "hash-old" }, // wiped, still countable
    { ip: "203.0.113.32", ip_hash: "hash-new" }, // recent: kept
  ]);
  const { rows: alert } = await e2eDb.query("SELECT title, subject FROM alert WHERE id = $1", [
    alerts[0]!.id,
  ]);
  expect(alert[0]).toEqual({ title: "Scanning from a wiped IP", subject: "a wiped IP" });
});
