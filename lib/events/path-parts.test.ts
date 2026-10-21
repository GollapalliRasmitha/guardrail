import { describe, expect, it } from "vitest";
import { pathParts } from "./path-parts";

describe("pathParts", () => {
  it("splits after each slash, so the path can only wrap there", () => {
    expect(pathParts("/api/auth/signin/")).toEqual({
      parts: ["/", "api/", "auth/", "signin/"],
      shortened: false,
    });
  });

  it("keeps short paths whole", () => {
    expect(pathParts("/.env")).toEqual({ parts: ["/", ".env"], shortened: false });
  });

  it("shortens one very long segment in the middle, never mid-way through a short word", () => {
    const long = "eval-stdin-really-long-scanner-file-name.php";
    const { parts, shortened } = pathParts(`/vendor/${long}`, 24);
    expect(shortened).toBe(true);
    expect(parts[0]).toBe("/");
    expect(parts[1]).toBe("vendor/");
    expect(parts[2]).toHaveLength(24);
    expect(parts[2]!.startsWith("eval-stdin-")).toBe(true);
    expect(parts[2]!.endsWith("name.php")).toBe(true);
    expect(parts[2]).toContain("…");
  });

  it("joining the full (not shortened) parts gives back the exact path", () => {
    const path = "/vendor/phpunit/phpunit/src/Util/PHP/eval-stdin.php";
    expect(pathParts(path).parts.join("")).toBe(path);
  });
});
