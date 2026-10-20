import { describe, expect, it } from "vitest";
import { filtersToQuery, matchesFilters, parseEventFilters, type EventView } from "./filters";

describe("parseEventFilters", () => {
  it("reads valid filters from the URL", () => {
    expect(
      parseEventFilters({ source: "homehaat", type: "login_failed", q: " wp-admin ", page: "3" }),
    ).toEqual({
      source: "homehaat",
      type: "login_failed",
      q: "wp-admin",
      page: 3,
    });
  });

  it("ignores junk instead of failing", () => {
    expect(parseEventFilters({ source: "evil", type: "<script>", page: "-2", q: "" })).toEqual({
      source: undefined,
      type: undefined,
      q: undefined,
      page: 1,
    });
  });

  it("takes the first value when a parameter repeats", () => {
    expect(parseEventFilters({ source: ["oppora", "homehaat"] }).source).toBe("oppora");
  });
});

describe("filtersToQuery", () => {
  it("round-trips, and leaves out page 1 and empty values", () => {
    expect(filtersToQuery({ source: "oppora", page: 1 })).toBe("?source=oppora");
    expect(filtersToQuery({ q: "a b", page: 2 })).toBe("?q=a+b&page=2");
    expect(filtersToQuery({})).toBe("");
  });
});

describe("matchesFilters", () => {
  const e: EventView = {
    id: 1,
    source: "homehaat",
    type: "suspicious_path",
    occurredAt: "2026-10-20T12:00:00Z",
    ip: "203.0.113.9",
    country: null,
    actor: null,
    path: "/wp-admin/setup.php",
    method: "GET",
    statusCode: 404,
  };
  it("matches by source, type and search text (case-insensitive)", () => {
    expect(matchesFilters(e, {})).toBe(true);
    expect(matchesFilters(e, { source: "oppora" })).toBe(false);
    expect(matchesFilters(e, { type: "login_failed" })).toBe(false);
    expect(matchesFilters(e, { q: "WP-ADMIN" })).toBe(true);
    expect(matchesFilters(e, { q: "203.0.113" })).toBe(true);
    expect(matchesFilters(e, { q: "nothing" })).toBe(false);
  });
});
