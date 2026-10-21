// How long GuardRail keeps things (pure, so it's unit-tested). lib/retention.ts applies it to the database.
import { createHash, timingSafeEqual } from "node:crypto";

const MIN = 60_000;
const DAY = 24 * 60 * MIN;

export const IP_DAYS = 30;

export function retentionCutoffs(now: Date) {
  return {
    ipBefore: new Date(now.getTime() - IP_DAYS * DAY), // raw IPs: 30 days (the keyed hash stays for counting)
    sessionExpiredBefore: now, // sessions: deleted once expired
    attemptsBefore: new Date(now.getTime() - DAY), // sign-in tries: 1 day (the limit looks back 15 minutes)
    noncesBefore: new Date(now.getTime() - 10 * MIN), // ingest nonces: 10 minutes (requests expire after 5)
  };
}

/** Is this Authorization header exactly "Bearer <secret>"? Constant-time; no secret set = always no. */
export function bearerMatches(header: string | null, secret: string | undefined): boolean {
  if (!secret || !header) return false;
  // Hash both sides so the compare has equal lengths and takes the same time whatever was sent.
  const digest = (text: string) => createHash("sha256").update(text).digest();
  return timingSafeEqual(digest(header), digest(`Bearer ${secret}`));
}
