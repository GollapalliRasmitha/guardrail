import { describe, expect, it } from "vitest";
import { checkLimit, LOGIN_LIMITS } from "./rate-limit";

const now = new Date("2026-10-20T12:00:00Z");
const minutesAgo = (m: number) => new Date(now.getTime() - m * 60_000);
const WINDOW = LOGIN_LIMITS.windowMs;

describe("checkLimit", () => {
  it("allows when there are fewer failures than the limit", () => {
    const failures = [minutesAgo(1), minutesAgo(2), minutesAgo(3), minutesAgo(4)];
    expect(checkLimit(failures, 5, WINDOW, now)).toEqual({ allowed: true });
  });

  it("blocks at the limit and says when to try again", () => {
    // newest first, like the SQL query returns them
    const failures = [minutesAgo(1), minutesAgo(2), minutesAgo(3), minutesAgo(4), minutesAgo(5)];
    // The 5th newest failure was 5 min ago, so the block ends 15 - 5 = 10 minutes from now.
    expect(checkLimit(failures, 5, WINDOW, now)).toEqual({ allowed: false, retryAfterSec: 600 });
  });

  it("ignores failures older than the window", () => {
    const failures = [minutesAgo(1), minutesAgo(2), minutesAgo(16), minutesAgo(17), minutesAgo(18)];
    expect(checkLimit(failures, 5, WINDOW, now)).toEqual({ allowed: true });
  });

  it("never returns a retry time below 1 second", () => {
    const edge = new Date(now.getTime() - WINDOW + 10);
    const failures = [minutesAgo(1), minutesAgo(1), minutesAgo(1), minutesAgo(1), edge];
    expect(checkLimit(failures, 5, WINDOW, now)).toEqual({ allowed: false, retryAfterSec: 1 });
  });

  it("uses the documented limits", () => {
    expect(LOGIN_LIMITS).toMatchObject({ perIp: 5, perAccount: 10, windowMs: 15 * 60_000 });
  });
});
