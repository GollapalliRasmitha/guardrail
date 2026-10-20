import "server-only";
import { and, count, eq, gt } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { sourceStats } from "@/lib/events/query";
import { SOURCES } from "@/lib/events/types";

const DAY_MS = 86_400_000;

/** Real numbers for the Overview page. Stage 4 adds alerts. */
export async function overviewStats(userId: string) {
  const dayAgo = new Date(Date.now() - DAY_MS);
  const [[failed], [sessions], [events], sources] = await Promise.all([
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
    db().select({ n: count() }).from(schema.event).where(gt(schema.event.receivedAt, dayAgo)),
    sourceStats(),
  ]);
  const online = SOURCES.filter((s) => sources[s].online).length;
  return {
    failedSignIns24h: failed?.n ?? 0,
    activeSessions: sessions?.n ?? 0,
    events24h: events?.n ?? 0,
    sourcesOnline: online,
    sources,
  };
}
