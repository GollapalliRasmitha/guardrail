import { describe, expect, it } from "vitest";
import { checkPasswordStrength, hashPassword, verifyPassword, verifyPasswordOrDummy } from "./password";

const GOOD = "violet-harbour-lantern-42";

describe("checkPasswordStrength", () => {
  it("accepts a long passphrase", () => {
    expect(checkPasswordStrength(GOOD, "me@example.com")).toBeNull();
  });

  it("needs at least 14 characters", () => {
    expect(checkPasswordStrength("Sh0rt-pass!", "me@example.com")).toMatch(/14/);
  });

  it("refuses very long input (stops slow-hash abuse)", () => {
    expect(checkPasswordStrength("a".repeat(129), "me@example.com")).toMatch(/128/);
  });

  it("refuses common passwords, ignoring case", () => {
    expect(checkPasswordStrength("Password12345678", "me@example.com")).toMatch(/common/);
  });

  it("refuses one character repeated or a simple sequence", () => {
    expect(checkPasswordStrength("aaaaaaaaaaaaaaaa", "me@example.com")).not.toBeNull();
    expect(checkPasswordStrength("12345678901234", "me@example.com")).not.toBeNull();
  });

  it("refuses a password that contains the email name", () => {
    expect(checkPasswordStrength("rasmitha-is-great-2026", "rasmitha@example.com")).toMatch(/email/);
  });
});

describe("hashPassword / verifyPassword (Argon2id)", () => {
  it("hashes with Argon2id and a random salt", async () => {
    const a = await hashPassword(GOOD);
    const b = await hashPassword(GOOD);
    expect(a.startsWith("$argon2id$")).toBe(true);
    expect(a).not.toBe(b);
    expect(a).not.toContain(GOOD);
  });

  it("verifies the right password and refuses a wrong one", async () => {
    const h = await hashPassword(GOOD);
    expect(await verifyPassword(h, GOOD)).toBe(true);
    expect(await verifyPassword(h, GOOD + "x")).toBe(false);
  });

  it("returns false (not an error) for a broken hash", async () => {
    expect(await verifyPassword("not-a-hash", GOOD)).toBe(false);
  });

  it("verifyPasswordOrDummy is always false for an unknown user, but still does the slow work", async () => {
    const started = performance.now();
    expect(await verifyPasswordOrDummy(null, GOOD)).toBe(false);
    expect(performance.now() - started).toBeGreaterThan(5);
  });
});
