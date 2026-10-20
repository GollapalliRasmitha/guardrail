import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { decryptWithKey, encryptWithKey, hmacHex, randomToken, sha256Hex } from "./crypto";

const key = randomBytes(32);

describe("AES-256-GCM", () => {
  it("round-trips text", () => {
    const blob = encryptWithKey(key, "MZXW6YTBOI");
    expect(blob.startsWith("v1.")).toBe(true);
    expect(blob).not.toContain("MZXW6YTBOI");
    expect(decryptWithKey(key, blob)).toBe("MZXW6YTBOI");
  });

  it("uses a fresh IV each time, so the same text never encrypts the same way twice", () => {
    expect(encryptWithKey(key, "same")).not.toBe(encryptWithKey(key, "same"));
  });

  it("refuses tampered data (the auth tag catches any change)", () => {
    const [v, iv, tag, ct] = encryptWithKey(key, "secret").split(".") as [string, string, string, string];
    const flipped = Buffer.from(ct, "base64url");
    flipped[0]! ^= 1;
    expect(() => decryptWithKey(key, [v, iv, tag, flipped.toString("base64url")].join("."))).toThrow();
  });

  it("refuses the wrong key", () => {
    expect(() => decryptWithKey(randomBytes(32), encryptWithKey(key, "secret"))).toThrow();
  });

  it("refuses a key that isn't 32 bytes", () => {
    expect(() => encryptWithKey(randomBytes(16), "x")).toThrow();
  });
});

describe("hashing helpers", () => {
  it("randomToken gives 256 bits, URL-safe, different every time", () => {
    const t = randomToken();
    expect(Buffer.from(t, "base64url")).toHaveLength(32);
    expect(t).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(randomToken()).not.toBe(t);
  });

  it("sha256Hex matches the known value", () => {
    expect(sha256Hex("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });

  it("hmacHex depends on the key", () => {
    expect(hmacHex(key, "1.2.3.4")).toBe(hmacHex(key, "1.2.3.4"));
    expect(hmacHex(randomBytes(32), "1.2.3.4")).not.toBe(hmacHex(key, "1.2.3.4"));
  });
});
