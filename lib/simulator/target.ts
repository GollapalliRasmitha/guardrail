// [KEY LOGIC] The attack simulator may only ever attack THIS computer. Never the live sites.

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * Returns the parsed URL if it points at this computer, otherwise throws. Uses the URL parser rather than text
 * matching, so tricks like "http://localhost@evil.com" (where "localhost" is only a user name) or
 * "localhost.evil.com" are caught.
 */
export function assertLocalTarget(target: string): URL {
  let url: URL;
  try {
    url = new URL(target);
  } catch {
    throw new Error(`Refusing: "${target}" is not a web address.`);
  }
  if (!["http:", "https:"].includes(url.protocol) || !LOCAL_HOSTS.has(url.hostname) || url.username) {
    throw new Error(
      `Refusing: ${url.host || target} is not this computer. The simulator only attacks localhost.`,
    );
  }
  return url;
}

// Ranges reserved for documentation and tests (RFC 5737): they never belong to a real person or company.
const TEST_NETS = ["192.0.2", "198.51.100", "203.0.113"];

/** A fake attacker IP. Stable for the same number, never a real address. */
export function testNetIp(n: number): string {
  const net = TEST_NETS[n % TEST_NETS.length]!;
  const host = (Math.floor(n / TEST_NETS.length) % 254) + 1; // 1..254
  return `${net}.${host}`;
}
