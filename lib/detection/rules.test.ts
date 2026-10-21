import { describe, expect, it } from "vitest";
import type { EventType } from "@/lib/events/types";
import { RULES, ruleFor, type RuleEvent } from "./rules";

const T0 = new Date("2026-10-21T10:00:00Z").getTime();
const sec = (s: number) => new Date(T0 + s * 1000);
let nextId = 1;

function ev(type: EventType, at: number, extra: Partial<RuleEvent> = {}): RuleEvent {
  return {
    id: nextId++,
    type,
    source: "homehaat",
    occurredAt: sec(at),
    ip: "203.0.113.9",
    ipHash: "ip-a",
    actor: "vi****@example.com",
    actorId: "acct-1",
    country: "IN",
    ...extra,
  };
}

/** Run a rule the way the engine does: the newest event is the trigger, history is everything (oldest first). */
function run(ruleId: Parameters<typeof ruleFor>[0], events: RuleEvent[]) {
  const rule = ruleFor(ruleId);
  return rule.evaluate(events[events.length - 1]!, events);
}

describe("brute force (T1110)", () => {
  const fails = (n: number, step = 30) => Array.from({ length: n }, (_, i) => ev("login_failed", i * step));

  it("fires at 10 failed logins for one account in 10 minutes, as high", () => {
    const finding = run("brute_force", fails(10));
    expect(finding?.severity).toBe("high");
    expect(finding?.eventIds).toHaveLength(10);
    expect(finding?.title).toBe("Brute force on vi****@example.com");
  });

  it("stays quiet at 9", () => {
    expect(run("brute_force", fails(9))).toBeNull();
  });

  it("only counts failures inside the 10-minute window", () => {
    // 10 failures spread over 15 minutes: never 10 inside any 10 minutes ending at the newest.
    expect(run("brute_force", fails(10, 100))).toBeNull();
  });

  it("groups by the account, so two people are never mixed up", () => {
    const rule = ruleFor("brute_force");
    expect(rule.keyOf(ev("login_failed", 0, { actorId: "acct-1" }))).not.toBe(
      rule.keyOf(ev("login_failed", 0, { actorId: "acct-2" })),
    );
    expect(rule.keyOf(ev("login_failed", 0, { actorId: null, actor: null }))).toBeNull();
  });
});

describe("credential stuffing (T1110.004)", () => {
  it("fires when one IP fails on 5 different accounts in 10 minutes", () => {
    const events = [1, 2, 3, 4, 5].map((n) => ev("login_failed", n * 10, { actorId: `acct-${n}` }));
    const finding = run("credential_stuffing", events);
    expect(finding?.severity).toBe("high");
    expect(finding?.title).toBe("Credential stuffing from 203.0.113.9");
  });

  it("does not fire for many tries on the SAME account (that's brute force)", () => {
    const events = Array.from({ length: 12 }, (_, i) => ev("login_failed", i));
    expect(run("credential_stuffing", events)).toBeNull();
  });
});

describe("forged webhook (T1565)", () => {
  it("fires on the first bad signature, as high", () => {
    const finding = run("forged_webhook", [
      ev("webhook_signature_failed", 0, { actor: null, actorId: null }),
    ]);
    expect(finding?.severity).toBe("high");
    expect(finding?.title).toBe("Forged payment webhook at HomeHaat");
  });
});

describe("scanning (T1595)", () => {
  it("one scanner path is low; 5 in 5 minutes from one IP is medium", () => {
    expect(run("scanning", [ev("suspicious_path", 0)])?.severity).toBe("low");
    const five = Array.from({ length: 5 }, (_, i) => ev("suspicious_path", i * 20));
    expect(run("scanning", five)?.severity).toBe("medium");
    expect(run("scanning", five)?.title).toBe("Scanning from 203.0.113.9");
  });
});

describe("flood (T1499)", () => {
  it("fires at 50 rate-limit hits from one IP within a minute", () => {
    const hits = (n: number) => Array.from({ length: n }, (_, i) => ev("rate_limited", i / 2));
    expect(run("flood", hits(49))).toBeNull();
    expect(run("flood", hits(50))?.severity).toBe("medium");
  });
});

describe("valid account from a new IP (T1078)", () => {
  const login = (at: number, ipHash: string, type: EventType = "login_success") =>
    ev(type, at, { ipHash, ip: ipHash === "ip-new" ? "198.51.100.7" : "203.0.113.9" });

  it("fires when an account with history signs in from an IP it never used in 30 days", () => {
    const finding = run("new_ip_login", [login(0, "ip-home"), login(60, "ip-home"), login(120, "ip-new")]);
    expect(finding?.severity).toBe("medium");
    expect(finding?.eventIds).toHaveLength(1); // only the suspicious sign-in itself
    expect(finding?.title).toBe("Sign-in from a new IP for vi****@example.com");
  });

  it("is high for an admin sign-in", () => {
    expect(run("new_ip_login", [login(0, "ip-home"), login(60, "ip-new", "admin_login")])?.severity).toBe(
      "high",
    );
  });

  it("stays quiet for a known IP, or an account's very first sign-in", () => {
    expect(run("new_ip_login", [login(0, "ip-home"), login(60, "ip-home")])).toBeNull();
    expect(run("new_ip_login", [login(0, "ip-new")])).toBeNull();
  });
});

describe("the rule list", () => {
  it("has six rules, each mapped to a MITRE ATT&CK technique", () => {
    expect(RULES.map((r) => [r.id, r.mitre.id])).toEqual([
      ["brute_force", "T1110"],
      ["credential_stuffing", "T1110.004"],
      ["forged_webhook", "T1565"],
      ["scanning", "T1595"],
      ["flood", "T1499"],
      ["new_ip_login", "T1078"],
    ]);
    for (const rule of RULES)
      expect(rule.mitre.url).toMatch(/^https:\/\/attack\.mitre\.org\/techniques\/T\d{4}/);
  });
});
