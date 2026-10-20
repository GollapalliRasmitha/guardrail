import { describe, expect, it } from "vitest";
import { assertThrowaway } from "./safety";

describe("assertThrowaway", () => {
  it("allows the local throwaway database", () => {
    expect(() =>
      assertThrowaway("postgres://guardrail:guardrail@localhost:5434/guardrail_e2e"),
    ).not.toThrow();
    expect(() =>
      assertThrowaway("postgres://guardrail:guardrail@127.0.0.1:5434/guardrail_e2e"),
    ).not.toThrow();
  });

  it("refuses the normal local database", () => {
    expect(() => assertThrowaway("postgres://guardrail:guardrail@localhost:5434/guardrail")).toThrow(
      /throwaway/,
    );
  });

  it("refuses any remote host, even with the right name (e.g. Neon)", () => {
    expect(() =>
      assertThrowaway("postgres://u:p@ep-cool-1.eu-central-1.aws.neon.tech/guardrail_e2e"),
    ).toThrow();
  });

  it("refuses look-alike names", () => {
    expect(() => assertThrowaway("postgres://u:p@localhost:5434/guardrail_e2e_real")).toThrow();
    expect(() => assertThrowaway("postgres://u:p@localhost:5434/guardrail_e2ex")).toThrow();
  });

  it("refuses nothing / garbage", () => {
    expect(() => assertThrowaway(undefined)).toThrow();
    expect(() => assertThrowaway("not a url")).toThrow();
  });
});
