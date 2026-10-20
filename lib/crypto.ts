import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from "node:crypto";
import { env } from "@/lib/env";

/** A random secret token: 32 bytes (256 bits), URL-safe text. Used for session cookies. */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

/** SHA-256 as hex. We store only this hash of a session token, so a database leak can't be used to sign in. */
export function sha256Hex(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

/** HMAC-SHA256 as hex: a hash only someone with the key can compute. */
export function hmacHex(key: Buffer, text: string): string {
  return createHmac("sha256", key).update(text).digest("hex");
}

/**
 * Hash an IP address or email for counting (rate limits) without storing the real value.
 * Keyed, so nobody can rebuild the IP by hashing all 4 billion IPv4 addresses without the key.
 */
export function privacyHash(value: string): string {
  return hmacHex(Buffer.from(env().HASH_SECRET, "base64"), value.trim().toLowerCase());
}

// ---- AES-256-GCM: encrypts the 2FA secret in the database --------------------------------------------------

const VERSION = "v1";

/** Encrypt text. Output: "v1.<iv>.<auth tag>.<ciphertext>", each part base64url. */
export function encryptWithKey(key: Buffer, plaintext: string): string {
  if (key.length !== 32) throw new Error("AES-256 needs a 32-byte key");
  const iv = randomBytes(12); // 96-bit IV, new every time: GCM must never reuse one with the same key
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag(); // proves the data wasn't changed
  return [VERSION, iv, tag, ciphertext]
    .map((p) => (typeof p === "string" ? p : p.toString("base64url")))
    .join(".");
}

/** Decrypt text from encryptWithKey. Throws if the key is wrong or anything was changed. */
export function decryptWithKey(key: Buffer, blob: string): string {
  const [version, iv, tag, ciphertext] = blob.split(".");
  if (version !== VERSION || !iv || !tag || !ciphertext) throw new Error("Unknown encrypted format");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64url")), decipher.final()]).toString(
    "utf8",
  );
}

const encryptionKey = () => Buffer.from(env().ENCRYPTION_KEY, "base64");
export const encryptSecret = (plaintext: string) => encryptWithKey(encryptionKey(), plaintext);
export const decryptSecret = (blob: string) => decryptWithKey(encryptionKey(), blob);
