import { describe, expect, it } from "vitest";
import { assertLocalTarget, testNetIp } from "./target";

describe("assertLocalTarget", () => {
  it("allows only this computer", () => {
    expect(assertLocalTarget("http://localhost:8000").origin).toBe("http://localhost:8000");
    expect(assertLocalTarget("http://127.0.0.1:8000/").origin).toBe("http://127.0.0.1:8000");
    expect(assertLocalTarget("http://[::1]:8000").origin).toBe("http://[::1]:8000");
  });

  it("refuses the live sites", () => {
    expect(() => assertLocalTarget("https://homehaat.vercel.app")).toThrow(/not this computer/);
    expect(() => assertLocalTarget("https://homehaat-api.onrender.com")).toThrow();
    expect(() => assertLocalTarget("https://oppora-app.vercel.app")).toThrow();
  });

  it("refuses look-alikes and tricks", () => {
    expect(() => assertLocalTarget("http://localhost.evil.com")).toThrow(); // a real domain starting with "localhost"
    expect(() => assertLocalTarget("http://127.0.0.1.nip.io")).toThrow(); // DNS that points anywhere
    expect(() => assertLocalTarget("http://localhost@evil.com")).toThrow(); // "localhost" is only the user name
    expect(() => assertLocalTarget("http://0.0.0.0:8000")).toThrow();
    expect(() => assertLocalTarget("http://192.168.1.20:8000")).toThrow(); // another device on the Wi-Fi
    expect(() => assertLocalTarget("file:///etc/passwd")).toThrow();
    expect(() => assertLocalTarget("not a url")).toThrow();
  });
});

describe("testNetIp", () => {
  it("only makes addresses from ranges reserved for documentation", () => {
    for (let i = 0; i < 600; i++) {
      expect(testNetIp(i)).toMatch(
        /^(192\.0\.2|198\.51\.100|203\.0\.113)\.([1-9]\d?|1\d\d|2[0-4]\d|25[0-4])$/,
      );
    }
  });
  it("is stable and spreads out", () => {
    expect(testNetIp(5)).toBe(testNetIp(5));
    expect(new Set(Array.from({ length: 50 }, (_, i) => testNetIp(i))).size).toBe(50);
  });
});
