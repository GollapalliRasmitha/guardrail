// Pure session rules (no database, no cookies), so they can be unit-tested.

const MIN = 60_000;

export const SESSION_RULES = {
  maxAgeMs: 12 * 60 * MIN, // signed out after 12 hours, no matter what
  idleMs: 2 * 60 * MIN, // ...or after 2 hours without using the dashboard
  pendingMs: 10 * MIN, // password OK but no 2FA code yet: 10 minutes to type it
  touchEveryMs: 5 * MIN, // update last_seen_at at most every 5 minutes (fewer database writes)
} as const;

export type SessionState = "active" | "needs-2fa" | "expired";

export function sessionState(
  s: { mfaPassed: boolean; expiresAt: Date; lastSeenAt: Date },
  now: Date,
): SessionState {
  if (s.expiresAt.getTime() <= now.getTime()) return "expired";
  if (now.getTime() - s.lastSeenAt.getTime() > SESSION_RULES.idleMs) return "expired";
  return s.mfaPassed ? "active" : "needs-2fa";
}
