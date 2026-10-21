import { describe, expect, it } from "vitest";
import { buildAlertEmail, DAILY_EMAIL_CAP, emailDecision } from "./email";

const base = { severity: "high" as const, emailedAt: null, sentLast24h: 0, configured: true };

describe("emailDecision", () => {
  it("emails a new high alert once", () => {
    expect(emailDecision(base)).toEqual({ send: true });
    expect(emailDecision({ ...base, emailedAt: new Date() })).toEqual({
      send: false,
      reason: "already_emailed",
    });
  });

  it("never emails medium or low", () => {
    expect(emailDecision({ ...base, severity: "medium" })).toEqual({ send: false, reason: "not_high" });
  });

  it("stops at the daily cap", () => {
    expect(emailDecision({ ...base, sentLast24h: DAILY_EMAIL_CAP - 1 })).toEqual({ send: true });
    expect(emailDecision({ ...base, sentLast24h: DAILY_EMAIL_CAP })).toEqual({
      send: false,
      reason: "daily_cap",
    });
  });

  it("says so when email isn't set up", () => {
    expect(emailDecision({ ...base, configured: false })).toEqual({ send: false, reason: "not_configured" });
  });
});

describe("buildAlertEmail", () => {
  const alert = {
    id: 42,
    ruleId: "credential_stuffing" as const,
    source: "homehaat" as const,
    severity: "high" as const,
    title: "Credential stuffing from 203.0.113.9",
    subject: "203.0.113.9",
    eventCount: 7,
    firstSeen: new Date("2026-10-21T10:00:00Z"),
  };

  it("has the rule, MITRE id, site and a link, but never the IP", () => {
    const email = buildAlertEmail(alert, "https://guardrail.example.app");
    expect(email.subject).toBe("[GuardRail] High: Credential stuffing (T1110.004) at HomeHaat");
    expect(email.text).toContain("https://guardrail.example.app/dashboard/alerts/42");
    expect(email.text).toContain("7 events");
    for (const part of [email.subject, email.text, email.html]) expect(part).not.toContain("203.0.113.9");
  });

  it("escapes HTML", () => {
    const email = buildAlertEmail({ ...alert, ruleId: "brute_force" }, "https://x.test/<b>");
    expect(email.html).not.toContain("<b>");
  });
});
