import { hash, verify } from "@node-rs/argon2";

// Argon2id with the library defaults: 19 MiB memory, 2 passes, 1 thread = OWASP's recommended minimum.
// "Memory-hard" means each guess needs real RAM, so attackers can't run millions of guesses on a GPU cheaply.
// The salt is random per hash and stored inside the result string ("$argon2id$v=19$m=19456,t=2,p=1$salt$hash").

const MIN_LENGTH = 14;
const MAX_LENGTH = 128; // hashing is slow on purpose; a 1 MB "password" would be a cheap way to load the server

// The most-used passwords from public breach lists, lower case. Anything containing one of these is refused.
const COMMON = [
  "password",
  "123456",
  "qwerty",
  "letmein",
  "welcome",
  "admin",
  "iloveyou",
  "monkey",
  "dragon",
  "football",
  "baseball",
  "sunshine",
  "princess",
  "abc123",
  "guardrail",
  "homehaat",
  "oppora",
];

/** Returns a plain-words problem, or null if the password is fine. */
export function checkPasswordStrength(password: string, email: string): string | null {
  if (password.length < MIN_LENGTH)
    return `Use at least ${MIN_LENGTH} characters (a few random words work well).`;
  if (password.length > MAX_LENGTH) return `Use at most ${MAX_LENGTH} characters.`;
  const lower = password.toLowerCase();
  if (COMMON.some((word) => lower.includes(word)))
    return "That contains a common password. Pick something else.";
  if (new Set(lower).size < 5) return "Use more different characters.";
  if ("01234567890123456789".includes(lower) || "abcdefghijklmnopqrstuvwxyz".includes(lower))
    return "Don't use a simple sequence.";
  const name = email.split("@")[0]?.toLowerCase() ?? "";
  if (name.length >= 4 && lower.includes(name)) return "Don't put your email name in the password.";
  return null;
}

export function hashPassword(password: string): Promise<string> {
  return hash(password); // Argon2id is the default algorithm
}

/** True only for the right password. A broken hash is a "no", never an error that could leak details. */
export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}

// Made once, the first time it's needed. Verifying against it takes as long as a real check.
let dummyHash: Promise<string> | undefined;

/**
 * Check a password when the account may not exist. If it doesn't, we still run Argon2 on a dummy hash, so
 * "unknown email" and "wrong password" take the same time: an attacker can't learn which emails exist.
 */
export async function verifyPasswordOrDummy(passwordHash: string | null, password: string): Promise<boolean> {
  if (passwordHash) return verifyPassword(passwordHash, password);
  dummyHash ??= hash("guardrail-timing-dummy-password");
  await verifyPassword(await dummyHash, password);
  return false;
}
