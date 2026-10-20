import { describe, expect, it } from "vitest";
import { MAX_CLOCK_SKEW_SEC, signRequest, verifySignature } from "./signature";

const secret = "s".repeat(43);
const body = JSON.stringify({ events: [{ type: "login_failed", occurred_at: "2026-10-20T12:00:00Z" }] });
const now = 1_760_000_000; // unix seconds
const nonce = "a".repeat(32);

function signed(overrides: Partial<{ secret: string; body: string; timestamp: number; nonce: string }> = {}) {
  const input = { secret, body, timestamp: now, nonce, ...overrides };
  return {
    ...input,
    signature: signRequest(input.secret, input.timestamp, input.nonce, input.body),
  };
}

const check = (
  s: ReturnType<typeof signed>,
  extra: Partial<{ body: string; secret: string; nowSec: number }> = {},
) =>
  verifySignature({
    secret: extra.secret ?? secret,
    timestampHeader: String(s.timestamp),
    nonceHeader: s.nonce,
    signatureHeader: s.signature,
    rawBody: extra.body ?? s.body,
    nowSec: extra.nowSec ?? now,
  });

describe("signRequest", () => {
  it("is hex HMAC-SHA256 of 'v1:timestamp:nonce:body'", () => {
    // Reference value computed separately with Python's hmac module. HomeHaat's Python client (Stage 3) is
    // tested against the same vector, so both sides provably sign the same way.
    expect(signRequest("test-secret", 1700000000, "00ff", '{"events":[]}')).toBe(
      "884ff67b8f561c7c4b1a8cd935409f9dd97be53755625abbb4e60bea4262e583",
    );
  });
});

describe("verifySignature", () => {
  it("accepts a correctly signed request", () => {
    expect(check(signed())).toEqual({ ok: true });
  });

  it("refuses a changed body (one character)", () => {
    expect(check(signed(), { body: body.replace("failed", "faileD") })).toEqual({
      ok: false,
      reason: "bad_signature",
    });
  });

  it("refuses the wrong secret (e.g. Oppora's secret on a HomeHaat request)", () => {
    expect(check(signed({ secret: "x".repeat(43) }))).toEqual({ ok: false, reason: "bad_signature" });
  });

  it("refuses a request older than 5 minutes (a replay of an old capture)", () => {
    expect(check(signed(), { nowSec: now + MAX_CLOCK_SKEW_SEC + 1 })).toEqual({ ok: false, reason: "stale" });
  });

  it("refuses a timestamp too far in the future", () => {
    expect(check(signed(), { nowSec: now - MAX_CLOCK_SKEW_SEC - 1 })).toEqual({ ok: false, reason: "stale" });
  });

  it("accepts small clock differences", () => {
    expect(check(signed(), { nowSec: now + 60 })).toEqual({ ok: true });
    expect(check(signed(), { nowSec: now - 60 })).toEqual({ ok: true });
  });

  it("refuses moving the signature to another timestamp or nonce", () => {
    const s = signed();
    expect(check({ ...s, timestamp: now + 1 })).toEqual({ ok: false, reason: "bad_signature" });
    expect(check({ ...s, nonce: "b".repeat(32) })).toEqual({ ok: false, reason: "bad_signature" });
  });

  it("refuses missing or malformed headers before doing any crypto", () => {
    const s = signed();
    const base = { secret, rawBody: body, nowSec: now };
    expect(
      verifySignature({ ...base, timestampHeader: null, nonceHeader: s.nonce, signatureHeader: s.signature }),
    ).toEqual({ ok: false, reason: "malformed" });
    expect(
      verifySignature({
        ...base,
        timestampHeader: "12.5",
        nonceHeader: s.nonce,
        signatureHeader: s.signature,
      }),
    ).toEqual({ ok: false, reason: "malformed" });
    expect(
      verifySignature({
        ...base,
        timestampHeader: String(now),
        nonceHeader: "short",
        signatureHeader: s.signature,
      }),
    ).toEqual({ ok: false, reason: "malformed" });
    expect(
      verifySignature({ ...base, timestampHeader: String(now), nonceHeader: s.nonce, signatureHeader: "zz" }),
    ).toEqual({ ok: false, reason: "malformed" });
  });

  it("refuses everything when the source has no secret configured", () => {
    const s = signed();
    expect(check(s, { secret: "" })).toEqual({ ok: false, reason: "no_secret" });
  });
});
