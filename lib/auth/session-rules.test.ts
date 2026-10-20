import { describe, expect, it } from "vitest";
import { SESSION_RULES, sessionState } from "./session-rules";

const now = new Date("2026-10-20T12:00:00Z");
const ago = (ms: number) => new Date(now.getTime() - ms);
const inFuture = (ms: number) => new Date(now.getTime() + ms);
const MIN = 60_000;

const fresh = { mfaPassed: true, expiresAt: inFuture(60 * MIN), lastSeenAt: ago(1 * MIN) };

describe("sessionState", () => {
  it("a fresh session with 2FA passed is 'active'", () => {
    expect(sessionState(fresh, now)).toBe("active");
  });

  it("password OK but no code yet is 'needs-2fa'", () => {
    expect(sessionState({ ...fresh, mfaPassed: false }, now)).toBe("needs-2fa");
  });

  it("is 'expired' after its hard expiry", () => {
    expect(sessionState({ ...fresh, expiresAt: ago(1) }, now)).toBe("expired");
  });

  it("is 'expired' after 2 hours idle, even before the hard expiry", () => {
    expect(sessionState({ ...fresh, lastSeenAt: ago(SESSION_RULES.idleMs + 1) }, now)).toBe("expired");
  });

  it("documents the lifetimes", () => {
    expect(SESSION_RULES).toEqual({
      maxAgeMs: 12 * 60 * MIN,
      idleMs: 2 * 60 * MIN,
      pendingMs: 10 * MIN,
      touchEveryMs: 5 * MIN,
    });
  });
});
