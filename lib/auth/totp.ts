import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

// TOTP = "Time-based One-Time Password" (RFC 6238), the 6-digit codes in Google Authenticator, Authy, 1Password…
// The app and GuardRail share a secret once (the QR code). After that, both compute
//   code = HOTP(secret, number of 30-second steps since 1970)
// and compare. Nothing is sent over the network, so the codes work offline and expire every 30 seconds.

const STEP_SECONDS = 30;
const DIGITS = 6;
const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

// ---- base32: the text format authenticator apps use for secrets ---------------------------------------------

export function base32Encode(bytes: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(text: string): Buffer {
  const clean = text.replace(/[\s=]/g, "").toUpperCase(); // people type keys with spaces and lower case
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const char of clean) {
    const index = BASE32.indexOf(char);
    if (index === -1) throw new Error("Not a base32 key");
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** A new random secret: 20 bytes = 160 bits, the size RFC 4226 recommends for HMAC-SHA1. */
export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

// ---- the code itself ------------------------------------------------------------------------------------------

/** HOTP (RFC 4226): HMAC-SHA1 of an 8-byte counter, then "dynamic truncation" down to 6 digits. */
export function hotp(secret: Buffer, counter: number): string {
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac("sha1", secret).update(message).digest();
  const offset = hmac[hmac.length - 1]! & 0x0f; // the last 4 bits pick where to read
  const number = hmac.readUInt32BE(offset) & 0x7fffffff; // 31 bits, sign bit dropped
  return (number % 10 ** DIGITS).toString().padStart(DIGITS, "0");
}

export function currentStep(nowMs: number): number {
  return Math.floor(nowMs / 1000 / STEP_SECONDS);
}

export function totpCode(secret: string, nowMs: number): string {
  return hotp(base32Decode(secret), currentStep(nowMs));
}

/**
 * Check a 6-digit code. Returns the time step it matched (save it as `lastUsedStep`), or null.
 * - Accepts the current step and one either side (phone clocks drift a little).
 * - Refuses any step <= lastUsedStep, so a code can't be used twice, even inside its 30 seconds.
 * - Compares in constant time.
 */
export function verifyTotp(input: {
  secret: string;
  code: string;
  nowMs: number;
  lastUsedStep: number;
}): number | null {
  if (!/^\d{6}$/.test(input.code)) return null;
  const key = base32Decode(input.secret);
  const now = currentStep(input.nowMs);
  for (const step of [now - 1, now, now + 1]) {
    if (step <= input.lastUsedStep) continue; // already used (or older than one that was)
    if (timingSafeEqual(Buffer.from(hotp(key, step)), Buffer.from(input.code))) return step;
  }
  return null;
}

/** The URL inside the QR code that authenticator apps scan. */
export function otpauthUrl(input: { secret: string; account: string; issuer: string }): string {
  const label = encodeURIComponent(`${input.issuer}:${input.account}`);
  const params = new URLSearchParams({
    secret: input.secret,
    issuer: input.issuer,
    algorithm: "SHA1",
    digits: String(DIGITS),
    period: String(STEP_SECONDS),
  });
  return `otpauth://totp/${label}?${params}`;
}
