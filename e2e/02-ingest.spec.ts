import { expect, test } from "@playwright/test";
import { e2eDb, sendSigned, testEvent } from "./helpers";

// The signed intake API, attacked the ways a real attacker would try.

test("a correctly signed batch is accepted and stored, with privacy rules applied", async ({ request }) => {
  const { response } = await sendSigned(request, [
    testEvent({
      actor: "Priya.Sharma@gmail.com",
      path: "/reset/?token=SECRET-RESET-TOKEN",
      ip: "203.0.113.50",
    }),
    testEvent({ type: "suspicious_path", path: "/.env", method: "GET", status_code: 404 }),
  ]);
  expect(response.status()).toBe(202);
  expect(await response.json()).toEqual({ accepted: 2, rejected: [] });

  const { rows } = await e2eDb.query(
    "SELECT actor, path, host(ip) AS ip, ip_hash FROM event WHERE host(ip) = '203.0.113.50'",
  );
  expect(rows[0].actor).toBe("pr****@gmail.com"); // full email never stored
  expect(rows[0].path).toBe("/reset/"); // the token in the query string never stored
  expect(rows[0].ip_hash).toMatch(/^[0-9a-f]{64}$/);
});

test("bad events are reported one by one; good ones in the same batch are kept", async ({ request }) => {
  const { response } = await sendSigned(request, [testEvent(), testEvent({ type: "made_up" })]);
  expect(response.status()).toBe(202);
  const body = await response.json();
  expect(body.accepted).toBe(1);
  expect(body.rejected).toEqual([{ index: 1, reason: expect.stringContaining("type") }]);
});

test("the same signed request sent twice is refused the second time (replay)", async ({ request }) => {
  const first = await sendSigned(request, [testEvent()]);
  expect(first.response.status()).toBe(202);
  const again = await sendSigned(request, [testEvent()], { nonce: first.nonce, timestamp: first.timestamp });
  // Note: a new occurred_at makes a different body, so this also has a different signature; the nonce alone
  // must still be refused. (An exact byte-for-byte replay is refused the same way.)
  expect(again.response.status()).toBe(401);
});

test("an exact byte-for-byte replay is refused", async ({ request }) => {
  const event = testEvent();
  const first = await sendSigned(request, [event]);
  expect(first.response.status()).toBe(202);
  const replay = await sendSigned(request, [event], { nonce: first.nonce, timestamp: first.timestamp });
  expect(replay.response.status()).toBe(401);
});

test("wrong secret, another site's secret, unknown source, or an old timestamp are all refused", async ({
  request,
}) => {
  expect((await sendSigned(request, [testEvent()], { signAs: "wrong" })).response.status()).toBe(401);
  expect(
    (await sendSigned(request, [testEvent()], { source: "oppora", signAs: "homehaat" })).response.status(),
  ).toBe(401);
  const stale = Math.floor(Date.now() / 1000) - 10 * 60;
  expect((await sendSigned(request, [testEvent()], { timestamp: stale })).response.status()).toBe(401);

  const unknown = await request.post("/api/ingest", {
    headers: { "X-GuardRail-Source": "evil-site" },
    data: { events: [testEvent()] },
  });
  expect(unknown.status()).toBe(401);
  const unsigned = await request.post("/api/ingest", {
    headers: { "X-GuardRail-Source": "homehaat" },
    data: { events: [testEvent()] },
  });
  expect(unsigned.status()).toBe(401);
  // Every failure looks the same from outside.
  expect(await unsigned.json()).toEqual({ error: { code: "unauthorized", message: "Unauthorized." } });
});

test("oversized and badly shaped bodies are refused", async ({ request }) => {
  const huge = JSON.stringify({ events: [testEvent({ user_agent: "x".repeat(70_000) })] });
  expect((await sendSigned(request, huge)).response.status()).toBe(413);
  expect((await sendSigned(request, JSON.stringify({ events: [] }))).response.status()).toBe(400);
  expect((await sendSigned(request, "not json")).response.status()).toBe(400);
});

test("reading events needs a signed-in session", async ({ request }) => {
  expect((await request.get("/api/events")).status()).toBe(401);
  expect((await request.get("/api/stream")).status()).toBe(401);
});
