import { and, desc, eq, gt, lt } from "drizzle-orm";
import { db, schema } from "@/lib/db";

export const LOGIN_LIMITS = {
  perIp: 5, // failed tries from one IP in the window
  perAccount: 10, // failed tries on the account from all IPs together
  windowMs: 15 * 60_000,
} as const;

export type LimitResult = { allowed: true } | { allowed: false; retryAfterSec: number };

/**
 * Pure rule (no database), so it's easy to test.
 * `failures` = times of recent failed tries, newest first. If `limit` of them fall inside the window, block until
 * the oldest of those `limit` failures leaves the window.
 */
export function checkLimit(failures: Date[], limit: number, windowMs: number, now: Date): LimitResult {
  const inWindow = failures.filter((t) => now.getTime() - t.getTime() < windowMs);
  if (inWindow.length < limit) return { allowed: true };
  const oldestCounted = inWindow[limit - 1]!;
  const unblockAt = oldestCounted.getTime() + windowMs;
  return { allowed: false, retryAfterSec: Math.max(1, Math.ceil((unblockAt - now.getTime()) / 1000)) };
}

type Kind = "password" | "totp";

async function recentFailures(
  column: "ipHash" | "emailHash",
  value: string,
  kind: Kind,
  limit: number,
  now: Date,
) {
  const since = new Date(now.getTime() - LOGIN_LIMITS.windowMs);
  const rows = await db()
    .select({ createdAt: schema.authAttempt.createdAt })
    .from(schema.authAttempt)
    .where(
      and(
        eq(schema.authAttempt[column], value),
        eq(schema.authAttempt.kind, kind),
        eq(schema.authAttempt.ok, false),
        gt(schema.authAttempt.createdAt, since),
      ),
    )
    .orderBy(desc(schema.authAttempt.createdAt))
    .limit(limit); // we only ever need the newest `limit` rows
  return rows.map((r) => r.createdAt);
}

/**
 * May this IP (and this account) try to sign in right now? Checks both limits; the longer wait wins.
 * Blocked tries are NOT recorded, so an attacker can't keep the account locked forever by hammering it.
 */
export async function loginAllowed(input: {
  ipHash: string;
  emailHash: string | null;
  kind: Kind;
}): Promise<LimitResult> {
  const now = new Date();
  const results = [
    checkLimit(
      await recentFailures("ipHash", input.ipHash, input.kind, LOGIN_LIMITS.perIp, now),
      LOGIN_LIMITS.perIp,
      LOGIN_LIMITS.windowMs,
      now,
    ),
  ];
  if (input.emailHash) {
    const failures = await recentFailures(
      "emailHash",
      input.emailHash,
      input.kind,
      LOGIN_LIMITS.perAccount,
      now,
    );
    results.push(checkLimit(failures, LOGIN_LIMITS.perAccount, LOGIN_LIMITS.windowMs, now));
  }
  const waits = results.filter((r) => !r.allowed).map((r) => r.retryAfterSec);
  return waits.length ? { allowed: false, retryAfterSec: Math.max(...waits) } : { allowed: true };
}

export async function recordAttempt(input: {
  ipHash: string;
  emailHash: string | null;
  kind: Kind;
  ok: boolean;
}) {
  await db().insert(schema.authAttempt).values(input);
}

/** Housekeeping: attempts older than a day are no longer needed for any limit. */
export async function pruneOldAttempts() {
  await db()
    .delete(schema.authAttempt)
    .where(lt(schema.authAttempt.createdAt, new Date(Date.now() - 86_400_000)));
}
