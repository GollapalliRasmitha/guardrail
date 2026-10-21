import { describe, expect, it } from "vitest";
import { hourlyBuckets, IST_OFFSET_MS, niceMax } from "./buckets";

const now = new Date("2026-10-21T10:25:00Z");

describe("hourlyBuckets", () => {
  it("makes 24 hourly buckets ending with the current hour, filling gaps with zeros", () => {
    const rows = [
      { hour: new Date("2026-10-21T10:00:00Z"), source: "homehaat" as const, n: 5 },
      { hour: new Date("2026-10-21T10:00:00Z"), source: "oppora" as const, n: 2 },
      { hour: new Date("2026-10-21T07:00:00Z"), source: "oppora" as const, n: 1 },
    ];
    const buckets = hourlyBuckets(rows, now);
    expect(buckets).toHaveLength(24);
    expect(buckets[0]!.start.toISOString()).toBe("2026-10-20T11:00:00.000Z");
    expect(buckets[23]).toMatchObject({ homehaat: 5, oppora: 2, total: 7 });
    expect(buckets[20]).toMatchObject({ homehaat: 0, oppora: 1, total: 1 });
    expect(buckets[5]).toMatchObject({ homehaat: 0, oppora: 0, total: 0 });
  });

  it("starts each hour on the hour in India time (UTC+5:30), when given the offset", () => {
    // 10:25 UTC = 15:55 IST, so the current IST hour started at 15:00 IST = 09:30 UTC.
    const rows = [{ hour: new Date("2026-10-21T09:30:00Z"), source: "homehaat" as const, n: 3 }];
    const buckets = hourlyBuckets(rows, now, IST_OFFSET_MS);
    expect(buckets[23]!.start.toISOString()).toBe("2026-10-21T09:30:00.000Z");
    expect(buckets[23]).toMatchObject({ homehaat: 3, total: 3 });
  });

  it("ignores rows outside the 24 hours", () => {
    const rows = [{ hour: new Date("2026-10-19T10:00:00Z"), source: "homehaat" as const, n: 9 }];
    expect(hourlyBuckets(rows, now).every((b) => b.total === 0)).toBe(true);
  });
});

describe("niceMax", () => {
  it("rounds the axis top up to a friendly number", () => {
    expect(niceMax(0)).toBe(4);
    expect(niceMax(3)).toBe(4);
    expect(niceMax(7)).toBe(8);
    expect(niceMax(23)).toBe(40);
    expect(niceMax(130)).toBe(200);
  });
});
