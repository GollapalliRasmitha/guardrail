import { describe, expect, it } from "vitest";
import {
  base32Decode,
  base32Encode,
  currentStep,
  generateTotpSecret,
  hotp,
  otpauthUrl,
  totpCode,
  verifyTotp,
} from "./totp";

// The official test secret from RFC 6238, appendix B ("12345678901234567890" as ASCII), in base32.
const RFC_SECRET = base32Encode(Buffer.from("12345678901234567890", "ascii"));
const at = (unixSeconds: number) => unixSeconds * 1000;

describe("base32", () => {
  it("round-trips bytes", () => {
    const bytes = Buffer.from([0, 1, 2, 250, 251, 252, 253, 254, 255]);
    expect(base32Decode(base32Encode(bytes))).toEqual(bytes);
  });

  it("matches the RFC 4648 examples", () => {
    expect(base32Encode(Buffer.from("foobar"))).toBe("MZXW6YTBOI");
    expect(base32Decode("MZXW6YTBOI").toString()).toBe("foobar");
  });

  it("ignores spaces, lower case and padding (people type keys by hand)", () => {
    expect(base32Decode("mzxw 6ytb oi==").toString()).toBe("foobar");
  });

  it("rejects characters that aren't base32", () => {
    expect(() => base32Decode("MZXW1")).toThrow();
  });
});

describe("hotp / totp", () => {
  it("matches RFC 6238 test vectors (last 6 digits of the 8-digit SHA-1 values)", () => {
    expect(totpCode(RFC_SECRET, at(59))).toBe("287082");
    expect(totpCode(RFC_SECRET, at(1111111109))).toBe("081804");
    expect(totpCode(RFC_SECRET, at(1111111111))).toBe("050471");
    expect(totpCode(RFC_SECRET, at(1234567890))).toBe("005924");
    expect(totpCode(RFC_SECRET, at(2000000000))).toBe("279037");
  });

  it("matches RFC 4226 HOTP test vectors", () => {
    const secret = Buffer.from("12345678901234567890", "ascii");
    expect(hotp(secret, 0)).toBe("755224");
    expect(hotp(secret, 9)).toBe("520489");
  });

  it("uses 30-second steps", () => {
    expect(currentStep(at(0))).toBe(0);
    expect(currentStep(at(29))).toBe(0);
    expect(currentStep(at(30))).toBe(1);
  });

  it("generates a 160-bit random secret", () => {
    const a = generateTotpSecret();
    expect(base32Decode(a)).toHaveLength(20);
    expect(generateTotpSecret()).not.toBe(a);
  });
});

describe("verifyTotp", () => {
  const now = at(1234567890);
  const step = currentStep(now);

  it("accepts the current code and returns its step", () => {
    const code = totpCode(RFC_SECRET, now);
    expect(verifyTotp({ secret: RFC_SECRET, code, nowMs: now, lastUsedStep: 0 })).toBe(step);
  });

  it("accepts one step of clock drift either way, but not two", () => {
    const prev = totpCode(RFC_SECRET, now - 30_000);
    const next = totpCode(RFC_SECRET, now + 30_000);
    const tooOld = totpCode(RFC_SECRET, now - 60_000);
    expect(verifyTotp({ secret: RFC_SECRET, code: prev, nowMs: now, lastUsedStep: 0 })).toBe(step - 1);
    expect(verifyTotp({ secret: RFC_SECRET, code: next, nowMs: now, lastUsedStep: 0 })).toBe(step + 1);
    expect(verifyTotp({ secret: RFC_SECRET, code: tooOld, nowMs: now, lastUsedStep: 0 })).toBeNull();
  });

  it("refuses a code that was already used (replay)", () => {
    const code = totpCode(RFC_SECRET, now);
    expect(verifyTotp({ secret: RFC_SECRET, code, nowMs: now, lastUsedStep: step })).toBeNull();
  });

  it("refuses an older code once a newer one was used", () => {
    const prev = totpCode(RFC_SECRET, now - 30_000);
    expect(verifyTotp({ secret: RFC_SECRET, code: prev, nowMs: now, lastUsedStep: step })).toBeNull();
  });

  it("refuses wrong, short, long and non-digit codes", () => {
    for (const code of ["000000", "12345", "1234567", "12a456", "", " 005924"]) {
      if (code === totpCode(RFC_SECRET, now)) continue;
      expect(verifyTotp({ secret: RFC_SECRET, code, nowMs: now, lastUsedStep: 0 })).toBeNull();
    }
  });
});

describe("otpauthUrl", () => {
  it("builds the URL authenticator apps read from the QR code", () => {
    const url = new URL(otpauthUrl({ secret: "MZXW6YTBOI", account: "me@example.com", issuer: "GuardRail" }));
    expect(url.protocol).toBe("otpauth:");
    expect(url.host).toBe("totp");
    expect(decodeURIComponent(url.pathname)).toBe("/GuardRail:me@example.com");
    expect(url.searchParams.get("secret")).toBe("MZXW6YTBOI");
    expect(url.searchParams.get("issuer")).toBe("GuardRail");
    expect(url.searchParams.get("digits")).toBe("6");
    expect(url.searchParams.get("period")).toBe("30");
  });
});
