import { describe, expect, it } from "vitest";
import { seeded } from "@/lib/demo/random";
import { nextAttack } from "./attacks";

describe("nextAttack", () => {
  it("in live mode, picks countries in proportion to the real totals", () => {
    const feed = {
      mode: "live" as const,
      total: 100,
      highAlerts: 0,
      countries: [
        { code: "US", lat: 39, lon: -98, attacks: 90 },
        { code: "NL", lat: 52, lon: 5.5, attacks: 10 },
      ],
    };
    const rand = seeded(1);
    const codes = Array.from({ length: 1000 }, (_, i) => nextAttack(rand, feed, i, 0).code);
    const us = codes.filter((c) => c === "US").length;
    expect(us).toBeGreaterThan(850);
    expect(us).toBeLessThan(950);
    expect(codes.every((c) => c === "US" || c === "NL")).toBe(true);
  });

  it("never marks an attack high when there were no high alerts", () => {
    const feed = {
      mode: "live" as const,
      total: 5,
      highAlerts: 0,
      countries: [{ code: "DE", lat: 51, lon: 10, attacks: 5 }],
    };
    const rand = seeded(2);
    expect(Array.from({ length: 200 }, (_, i) => nextAttack(rand, feed, i, 0).high).some(Boolean)).toBe(
      false,
    );
  });

  it("in simulated mode, uses known countries and sometimes a high alert", () => {
    const rand = seeded(3);
    const attacks = Array.from({ length: 300 }, (_, i) =>
      nextAttack(rand, { mode: "simulated", total: 0, highAlerts: 0, countries: [] }, i, 0),
    );
    expect(attacks.every((a) => Number.isFinite(a.lat) && Number.isFinite(a.lon))).toBe(true);
    expect(attacks.some((a) => a.high)).toBe(true);
  });
});
