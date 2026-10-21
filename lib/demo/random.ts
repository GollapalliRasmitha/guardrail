// A tiny seeded random generator (mulberry32): the same seed always gives the same numbers, so the demo looks the
// same on every visit and the server and browser agree. Not for anything secret.

export type Random = {
  next: () => number; // 0 ≤ n < 1
  int: (min: number, max: number) => number; // min ≤ n ≤ max
  pick: <T>(items: readonly T[]) => T;
};

export function seeded(seed: number): Random {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    pick: (items) => items[Math.floor(next() * items.length)]!,
  };
}

// Fake people and attackers, shared by the demo world (server) and the demo live feed (browser).
// Emails are already masked; IPs come only from the ranges reserved for documentation (RFC 5737).
export const DEMO_USERS = [
  { actor: "pr****@example.com", ip: "198.51.100.11", country: "IN" },
  { actor: "ar****@example.com", ip: "198.51.100.12", country: "IN" },
  { actor: "me****@example.com", ip: "198.51.100.13", country: "IN" },
  { actor: "ka****@example.com", ip: "198.51.100.14", country: "IN" },
  { actor: "sa****@example.com", ip: "198.51.100.15", country: "IN" },
  { actor: "jo****@example.com", ip: "198.51.100.16", country: "GB" },
  { actor: "ni****@example.com", ip: "198.51.100.17", country: "IN" },
  { actor: "de****@example.com", ip: "198.51.100.18", country: "AE" },
  { actor: "an****@example.com", ip: "198.51.100.19", country: "IN" },
  { actor: "ro****@example.com", ip: "198.51.100.20", country: "US" },
] as const;

export const ATTACKER_COUNTRIES = ["US", "NL", "DE", "CN", "RU", "BR", "UA", "VN", "FR", "GB"] as const;

export const SCANNER_PATHS = [
  "/.env",
  "/.git/config",
  "/wp-admin/",
  "/wp-login.php",
  "/phpmyadmin/",
  "/xmlrpc.php",
  "/server-status",
  "/backup.sql",
  "/vendor/phpunit/phpunit/src/Util/PHP/eval-stdin.php",
] as const;
