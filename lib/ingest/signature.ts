import { createHmac, timingSafeEqual } from "node:crypto";

// How HomeHaat and Oppora prove a request really came from them, and is fresh.
//
//   message   = "v1:" + timestamp + ":" + nonce + ":" + raw body
//   signature = hex( HMAC-SHA256(source's secret, message) )
//
// The timestamp and nonce are INSIDE the signed message, so an attacker can't change them without breaking the
// signature. The timestamp limits a captured request to 5 minutes; the nonce (checked in the database) stops it
// being sent again even within those 5 minutes.

export const MAX_CLOCK_SKEW_SEC = 5 * 60;

export function signRequest(secret: string, timestamp: number, nonce: string, rawBody: string): string {
  return createHmac("sha256", secret).update(`v1:${timestamp}:${nonce}:${rawBody}`).digest("hex");
}

export type VerifyResult =
  { ok: true } | { ok: false; reason: "no_secret" | "malformed" | "stale" | "bad_signature" };

export function verifySignature(input: {
  secret: string;
  timestampHeader: string | null;
  nonceHeader: string | null;
  signatureHeader: string | null;
  rawBody: string;
  nowSec: number;
}): VerifyResult {
  // A missing secret must never mean "trust everything".
  if (input.secret.length === 0) return { ok: false, reason: "no_secret" };

  const { timestampHeader: ts, nonceHeader: nonce, signatureHeader: sig } = input;
  if (!ts || !/^\d{1,12}$/.test(ts)) return { ok: false, reason: "malformed" };
  if (!nonce || !/^[0-9a-f]{32,128}$/i.test(nonce)) return { ok: false, reason: "malformed" };
  if (!sig || !/^[0-9a-f]{64}$/i.test(sig)) return { ok: false, reason: "malformed" };

  const timestamp = Number(ts);
  if (Math.abs(input.nowSec - timestamp) > MAX_CLOCK_SKEW_SEC) return { ok: false, reason: "stale" };

  const expected = Buffer.from(signRequest(input.secret, timestamp, nonce, input.rawBody), "hex");
  const given = Buffer.from(sig, "hex");
  // Constant-time compare: takes the same time wherever the first wrong byte is, so timing can't leak it.
  if (!timingSafeEqual(expected, given)) return { ok: false, reason: "bad_signature" };
  return { ok: true };
}
