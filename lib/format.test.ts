import { describe, expect, it } from "vitest";
import { formatCount, formatTime } from "./format";

describe("formatTime", () => {
  it("shows India time, 24-hour", () => {
    expect(formatTime("2026-10-20T12:00:05Z")).toBe("20 Oct, 17:30:05");
    expect(formatTime(new Date("2026-10-20T20:00:00Z"))).toBe("21 Oct, 01:30:00");
  });
});

describe("formatCount", () => {
  it("uses Indian digit grouping", () => {
    expect(formatCount(1234567)).toBe("12,34,567");
  });
});
