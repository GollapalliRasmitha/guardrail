import "server-only";
import { and, count, desc, gt, gte, isNotNull, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { firstBucketStart, hourlyBuckets, IST_OFFSET_MS } from "./buckets";

const e = schema.event;

/**
 * Events per hour and site, last 24 hours (one grouped query, filled with zero hours by hourlyBuckets).
 * Hours are India-time hours: truncated in Asia/Kolkata, then turned back into a moment in time.
 */
export async function eventsPerHour(now = new Date()) {
  const since = firstBucketStart(now, IST_OFFSET_MS); // where the chart's first bar starts
  const hour =
    sql<Date>`date_trunc('hour', ${e.receivedAt} AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata'`.mapWith(
      (v: string | Date) => new Date(v),
    );
  const rows = await db()
    .select({ hour, source: e.source, n: count() })
    .from(e)
    .where(gte(e.receivedAt, since))
    .groupBy(hour, e.source);
  return hourlyBuckets(rows, now, IST_OFFSET_MS);
}

/**
 * The IPs with the most events in the last 24 hours. Grouped by the keyed IP hash (which stays after the IP itself
 * is wiped); the newest raw IP of each group is shown if it still exists.
 */
export async function topIps(limit = 5, now = new Date()) {
  const since = new Date(now.getTime() - 24 * 3_600_000);
  return db()
    .select({
      ipHash: e.ipHash,
      ip: sql<string | null>`(array_agg(host(${e.ip}) order by ${e.id} desc))[1]`,
      country: sql<string | null>`(array_agg(${e.country} order by ${e.id} desc))[1]`,
      n: count(),
    })
    .from(e)
    .where(and(gt(e.receivedAt, since), isNotNull(e.ipHash)))
    .groupBy(e.ipHash)
    .orderBy(desc(count()))
    .limit(limit);
}
