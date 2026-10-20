import "server-only";
import { and, count, eq, gt } from "drizzle-orm";
import { db, schema } from "@/lib/db";

/** Real numbers for the Overview page. Stage 2+ adds events, alerts and sources. */
export async function securityOverview(userId: string) {
  const dayAgo = new Date(Date.now() - 86_400_000);
  const [[failed], [sessions]] = await Promise.all([
    db()
      .select({ n: count() })
      .from(schema.authAttempt)
      .where(and(eq(schema.authAttempt.ok, false), gt(schema.authAttempt.createdAt, dayAgo))),
    db()
      .select({ n: count() })
      .from(schema.session)
      .where(
        and(
          eq(schema.session.userId, userId),
          eq(schema.session.mfaPassed, true),
          gt(schema.session.expiresAt, new Date()),
        ),
      ),
  ]);
  return { failedSignIns24h: failed?.n ?? 0, activeSessions: sessions?.n ?? 0 };
}
