import { describe, expect, it } from "vitest";
import { parseCursor, sseComment, sseMessage } from "./sse";

describe("Server-Sent Events format", () => {
  it("writes id, event name and JSON data, ending with a blank line", () => {
    expect(sseMessage({ id: 42, event: "events", data: [{ a: 1 }] })).toBe(
      'id: 42\nevent: events\ndata: [{"a":1}]\n\n',
    );
  });

  it("never lets data break out of its line (JSON has no raw newlines)", () => {
    const text = sseMessage({ id: 1, event: "events", data: { path: "/x\nevent: fake" } });
    expect(text.split("\n").filter((l) => l.startsWith("event:"))).toHaveLength(1);
  });

  it("writes comments (heartbeats) that EventSource ignores", () => {
    expect(sseComment("ping")).toBe(": ping\n\n");
  });
});

describe("parseCursor", () => {
  it("reads Last-Event-ID or ?after=", () => {
    expect(parseCursor("17", null)).toBe(17);
    expect(parseCursor(null, "9")).toBe(9);
    expect(parseCursor("17", "9")).toBe(17); // the browser's Last-Event-ID wins on reconnect
  });
  it("treats missing or garbage as 'no cursor'", () => {
    expect(parseCursor(null, null)).toBeNull();
    expect(parseCursor("abc", "-5")).toBeNull();
    expect(parseCursor("1e9", null)).toBeNull();
  });
});
