import { describe, expect, it } from "vitest";
import { RULE_IDS } from "@/lib/alerts/types";
import { demoWorld } from "./world";

const now = new Date("2026-10-21T12:00:00Z");
const DOC_RANGES = /^(192\.0\.2|198\.51\.100|203\.0\.113)\.\d{1,3}$/; // RFC 5737: never real people

describe("demoWorld (fake data for the public demo)", () => {
  const world = demoWorld(now);

  it("is the same every time (alert links stay valid between pages)", () => {
    const again = demoWorld(now);
    expect(again.alerts.map((a) => [a.id, a.title])).toEqual(world.alerts.map((a) => [a.id, a.title]));
    expect(again.events.length).toBe(world.events.length);
  });

  it("has a day of events, newest last, all in the past 24 hours", () => {
    expect(world.events.length).toBeGreaterThan(300);
    const times = world.events.map((e) => new Date(e.occurredAt).getTime());
    expect(times).toEqual([...times].sort((a, b) => a - b));
    expect(Math.min(...times)).toBeGreaterThan(now.getTime() - 24 * 3_600_000);
    expect(Math.max(...times)).toBeLessThanOrEqual(now.getTime());
  });

  it("raises every kind of alert through the real detection rules", () => {
    expect(new Set(world.alerts.map((a) => a.ruleId))).toEqual(new Set(RULE_IDS));
    for (const alert of world.alerts) {
      expect(world.evidence(alert.id).length).toBeGreaterThan(0);
      expect(world.activity(alert.id)[0]?.kind).toBe("created");
    }
    expect(world.alerts.some((a) => a.status === "open")).toBe(true);
    expect(world.alerts.some((a) => a.status === "resolved")).toBe(true);
  });

  it("only uses documentation IP addresses and masked emails", () => {
    for (const e of world.events) {
      if (e.ip) expect(e.ip).toMatch(DOC_RANGES);
      if (e.actor) expect(e.actor).toContain("****");
    }
  });

  it("gives each IP one country, like real data (an attacker doesn't hop countries between tries)", () => {
    const countries = new Map<string, Set<string | null>>();
    for (const e of world.events) {
      if (!e.ip) continue;
      countries.set(e.ip, (countries.get(e.ip) ?? new Set()).add(e.country));
    }
    expect([...countries.values()].every((set) => set.size === 1)).toBe(true);
  });

  it("builds the Overview numbers from the same events", () => {
    const o = world.overview;
    expect(o.stats.events24h).toBe(world.events.length);
    // The chart's 24 bars start at the top of the hour 23 hours ago; it counts every event from then on.
    const chartStart = new Date(o.buckets[0]!.start).getTime();
    const charted = world.events.filter((e) => new Date(e.occurredAt).getTime() >= chartStart).length;
    expect(o.buckets.reduce((n, b) => n + b.total, 0)).toBe(charted);
    expect(o.alertCounts.total).toBe(world.alerts.filter((a) => a.status !== "resolved").length);
    expect(o.latest[0]!.id).toBe(world.events.at(-1)!.id); // newest first
  });
});
