import { describe, expect, it } from "vitest";
import { maskActor, parseBatch, MAX_EVENTS_PER_BATCH } from "./schema";

const now = new Date("2026-10-20T12:00:00Z");
const ok = { type: "login_failed", occurred_at: "2026-10-20T11:59:00Z" };

describe("maskActor", () => {
  it("masks emails, keeping 2 letters and the domain", () => {
    expect(maskActor("rasmitha@gmail.com")).toBe("ra****@gmail.com");
    expect(maskActor("Ab@x.io")).toBe("ab****@x.io");
  });
  it("leaves already-masked emails alone", () => {
    expect(maskActor("ra****@gmail.com")).toBe("ra****@gmail.com");
  });
  it("masks other names too (usernames, phone numbers)", () => {
    expect(maskActor("9876543210")).toBe("98****");
    expect(maskActor("x")).toBe("x****");
  });
});

describe("parseBatch", () => {
  it("accepts a valid batch and normalises each event", () => {
    const result = parseBatch(
      {
        events: [
          {
            ...ok,
            ip: "203.0.113.9",
            actor: "rasmitha@gmail.com",
            path: "/api/auth/signin/?next=/orders&token=SECRET",
            method: "post",
            status_code: 401,
            user_agent: "x".repeat(500),
            country: "in",
            meta: { reason: "wrong_password" },
          },
        ],
      },
      now,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rejected).toEqual([]);
    const e = result.accepted[0]!;
    expect(e.actor).toBe("ra****@gmail.com"); // masked even if the sender forgot
    expect(e.path).toBe("/api/auth/signin/"); // query string dropped: it can hold tokens
    expect(e.method).toBe("POST");
    expect(e.userAgent).toHaveLength(200);
    expect(e.country).toBe("IN");
    expect(e.ip).toBe("203.0.113.9");
    expect(e.meta).toEqual({ reason: "wrong_password" });
  });

  it("accepts IPv6", () => {
    const r = parseBatch({ events: [{ ...ok, ip: "2001:db8::1" }] }, now);
    expect(r.ok && r.accepted[0]!.ip).toBe("2001:db8::1");
  });

  it("drops meta keys that aren't on the allow-list (no surprise personal data)", () => {
    const r = parseBatch(
      { events: [{ ...ok, meta: { reason: "x", password: "hunter2", card: "4111" } }] },
      now,
    );
    expect(r.ok && r.accepted[0]!.meta).toEqual({ reason: "x" });
  });

  it("rejects bad events one by one, keeping the good ones", () => {
    const r = parseBatch(
      {
        events: [
          ok,
          { ...ok, type: "made_up" },
          { ...ok, ip: "999.1.1.1" },
          { ...ok, occurred_at: "yesterday" },
        ],
      },
      now,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.accepted).toHaveLength(1);
    expect(r.rejected.map((x) => x.index)).toEqual([1, 2, 3]);
  });

  it("rejects events from the far future or older than 7 days", () => {
    const r = parseBatch(
      {
        events: [
          { ...ok, occurred_at: "2026-10-20T13:00:00Z" },
          { ...ok, occurred_at: "2026-10-01T00:00:00Z" },
        ],
      },
      now,
    );
    expect(r.ok && r.rejected).toHaveLength(2);
  });

  it("refuses a batch that isn't the right shape", () => {
    expect(parseBatch(null, now).ok).toBe(false);
    expect(parseBatch({ events: [] }, now).ok).toBe(false);
    expect(parseBatch({ events: "x" }, now).ok).toBe(false);
    expect(parseBatch({ events: Array(MAX_EVENTS_PER_BATCH + 1).fill(ok) }, now).ok).toBe(false);
  });
});
