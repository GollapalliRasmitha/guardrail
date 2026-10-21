import { describe, expect, it } from "vitest";
import { bearerMatches, retentionCutoffs } from "./retention-rules";

describe("retentionCutoffs", () => {
  it("keeps IPs 30 days, sessions until they expire, sign-in tries 1 day, nonces 10 minutes", () => {
    const now = new Date("2026-10-21T03:00:00Z");
    expect(retentionCutoffs(now)).toEqual({
      ipBefore: new Date("2026-09-21T03:00:00Z"),
      sessionExpiredBefore: now,
      attemptsBefore: new Date("2026-10-20T03:00:00Z"),
      noncesBefore: new Date("2026-10-21T02:50:00Z"),
    });
  });
});

describe("bearerMatches (the scheduler's secret)", () => {
  const secret = "a-cron-secret-that-is-long-enough-000000";
  it("accepts exactly 'Bearer <secret>'", () => {
    expect(bearerMatches(`Bearer ${secret}`, secret)).toBe(true);
  });
  it("refuses a wrong, missing or partial value, and refuses everything when no secret is set", () => {
    expect(bearerMatches(`Bearer ${secret}x`, secret)).toBe(false);
    expect(bearerMatches(secret, secret)).toBe(false);
    expect(bearerMatches(null, secret)).toBe(false);
    expect(bearerMatches("Bearer ", "")).toBe(false);
    expect(bearerMatches("Bearer undefined", undefined)).toBe(false);
  });
});
