import "server-only";
import { eq, lt, or } from "drizzle-orm";
import { cookies } from "next/headers";
import { randomToken, sha256Hex } from "@/lib/crypto";
import { db, schema } from "@/lib/db";
import type { AdminUser, Session } from "@/lib/db/schema";
import { isProduction } from "@/lib/env";
import { SESSION_RULES, sessionState, type SessionState } from "./session-rules";

// The cookie holds a random 256-bit token. The database holds only SHA-256(token), so someone who reads the
// database (a leaked backup, say) still can't sign in. Online, the "__Host-" prefix makes the browser refuse the
// cookie unless it's Secure, has Path=/ and no Domain, so a sub-domain can't plant or overwrite it.
export const SESSION_COOKIE = isProduction() ? "__Host-guardrail_session" : "guardrail_session";

export type CurrentSession = { session: Session; user: AdminUser; state: Exclude<SessionState, "expired"> };

async function setCookie(token: string, expiresAt: Date) {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true, // JavaScript can't read it, so an XSS bug can't steal it
    secure: isProduction(), // HTTPS only online (localhost is plain http)
    sameSite: "lax", // not sent on cross-site POSTs; still sent when I click the link in an alert email
    path: "/",
    expires: expiresAt,
  });
}

/**
 * Start a session. `mfaPassed: false` = the password was right but the 2FA code is still needed; that session
 * lives only 10 minutes and can do nothing except enter a code.
 */
export async function createSession(input: {
  userId: string;
  mfaPassed: boolean;
  ipHash: string;
  userAgent: string;
}) {
  const token = randomToken();
  const lifetime = input.mfaPassed ? SESSION_RULES.maxAgeMs : SESSION_RULES.pendingMs;
  const expiresAt = new Date(Date.now() + lifetime);
  await db()
    .insert(schema.session)
    .values({
      tokenHash: sha256Hex(token),
      userId: input.userId,
      mfaPassed: input.mfaPassed,
      expiresAt,
      ipHash: input.ipHash,
      userAgent: input.userAgent.slice(0, 200),
    });
  await setCookie(token, expiresAt);
}

/** Who is this request from? null = nobody (no cookie, unknown token, expired or idle too long). */
export async function getCurrentSession(): Promise<CurrentSession | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const [row] = await db()
    .select({ session: schema.session, user: schema.adminUser })
    .from(schema.session)
    .innerJoin(schema.adminUser, eq(schema.session.userId, schema.adminUser.id))
    .where(eq(schema.session.tokenHash, sha256Hex(token)))
    .limit(1);
  if (!row) return null;

  const now = new Date();
  const state = sessionState(row.session, now);
  if (state === "expired") {
    await db().delete(schema.session).where(eq(schema.session.id, row.session.id));
    return null;
  }
  // Sliding idle timeout, written at most every 5 minutes.
  if (now.getTime() - row.session.lastSeenAt.getTime() > SESSION_RULES.touchEveryMs) {
    await db().update(schema.session).set({ lastSeenAt: now }).where(eq(schema.session.id, row.session.id));
  }
  return { ...row, state };
}

/** Sign out this browser: delete the row (so the token is dead even if copied) and clear the cookie. */
export async function endCurrentSession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token)
    await db()
      .delete(schema.session)
      .where(eq(schema.session.tokenHash, sha256Hex(token)));
  jar.delete(SESSION_COOKIE);
}

/** Sign out everywhere: every session of this user, on every device. */
export async function endAllSessions(userId: string) {
  await db().delete(schema.session).where(eq(schema.session.userId, userId));
  (await cookies()).delete(SESSION_COOKIE);
}

/**
 * After the 2FA code is right: throw away the "password only" session and start a brand-new one.
 * A new token at every privilege step stops "session fixation" (someone planting a token before I sign in).
 */
export async function upgradeSession(current: CurrentSession, ipHash: string, userAgent: string) {
  await db().delete(schema.session).where(eq(schema.session.id, current.session.id));
  await createSession({ userId: current.user.id, mfaPassed: true, ipHash, userAgent });
}

/** Housekeeping: remove expired sessions. */
export async function pruneExpiredSessions() {
  const idleCutoff = new Date(Date.now() - SESSION_RULES.idleMs);
  await db()
    .delete(schema.session)
    .where(or(lt(schema.session.expiresAt, new Date()), lt(schema.session.lastSeenAt, idleCutoff)));
}
