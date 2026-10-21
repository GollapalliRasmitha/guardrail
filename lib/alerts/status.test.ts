import { describe, expect, it } from "vitest";
import { canMove, nextActions } from "./status";

describe("alert status moves", () => {
  it("allows the normal flow and reopening", () => {
    expect(canMove("open", "acknowledged")).toBe(true);
    expect(canMove("acknowledged", "resolved")).toBe(true);
    expect(canMove("open", "resolved")).toBe(true);
    expect(canMove("resolved", "open")).toBe(true);
    expect(canMove("acknowledged", "open")).toBe(true);
  });

  it("refuses no-op and skipped moves", () => {
    expect(canMove("open", "open")).toBe(false);
    expect(canMove("resolved", "acknowledged")).toBe(false);
  });

  it("lists the buttons for each status, main action first", () => {
    expect(nextActions("open").map((a) => a.to)).toEqual(["acknowledged", "resolved"]);
    expect(nextActions("acknowledged").map((a) => a.to)).toEqual(["resolved", "open"]);
    expect(nextActions("resolved").map((a) => a.label)).toEqual(["Reopen"]);
  });
});
