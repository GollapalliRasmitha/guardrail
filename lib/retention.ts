import "server-only";
import { and, isNotNull, like, lt, ne, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { retentionCutoffs } from "./retention-rules";

export const WIPED_IP = "a wiped IP";

/**
 * The daily clean-up (Vercel Cron → GET /api/cron/retention):
 * - raw IPs older than 30 days are set to NULL; ip_hash stays, so counts and rules still work;
 * - alerts about an IP that was last seen over 30 days ago lose the IP from their title and subject;
 * - expired sessions, old sign-in tries and old ingest nonces are deleted.
 * Each step is one indexed statement; the numbers are returned for the log.
 */
export async function runRetention(now = new Date()) {
  const cut = retentionCutoffs(now);
  const e = schema.event;
  const a = schema.alert;

  const ips = await db()
    .update(e)
    .set({ ip: null })
    .where(and(isNotNull(e.ip), lt(e.receivedAt, cut.ipBefore)))
    .returning({ id: e.id });

  const alerts = await db()
    .update(a)
    .set({ title: sql`replace(${a.title}, ${a.subject}, ${WIPED_IP})`, subject: WIPED_IP })
    .where(and(like(a.groupKey, "%:ip:%"), ne(a.subject, WIPED_IP), lt(a.lastSeen, cut.ipBefore)))
    .returning({ id: a.id });

  const sessions = await db()
    .delete(schema.session)
    .where(lt(schema.session.expiresAt, cut.sessionExpiredBefore))
    .returning({ id: schema.session.id });
  const attempts = await db()
    .delete(schema.authAttempt)
    .where(lt(schema.authAttempt.createdAt, cut.attemptsBefore))
    .returning({ id: schema.authAttempt.id });
  const nonces = await db()
    .delete(schema.ingestNonce)
    .where(lt(schema.ingestNonce.createdAt, cut.noncesBefore))
    .returning({ nonce: schema.ingestNonce.nonce });

  return {
    ipsWiped: ips.length,
    alertsWiped: alerts.length,
    sessionsDeleted: sessions.length,
    attemptsDeleted: attempts.length,
    noncesDeleted: nonces.length,
  };
}
