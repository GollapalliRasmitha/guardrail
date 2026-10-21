import "server-only";
import { and, asc, count, desc, eq, inArray, ne, type SQL } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { toView } from "@/lib/events/query";
import { ALERT_PAGE_SIZE, type AlertFilters } from "./filters";
import type { Severity } from "./types";

const a = schema.alert;

function whereFor(f: AlertFilters): SQL | undefined {
  const parts: (SQL | undefined)[] = [];
  if (f.view === "active") parts.push(ne(a.status, "resolved"));
  else if (f.view !== "all") parts.push(eq(a.status, f.view));
  if (f.severity) parts.push(eq(a.severity, f.severity));
  if (f.source) parts.push(eq(a.source, f.source));
  return and(...parts);
}

/** A page of alerts: the most recently active first. */
export async function listAlerts(f: AlertFilters) {
  const where = whereFor(f);
  const [rows, [total]] = await Promise.all([
    db()
      .select()
      .from(a)
      .where(where)
      .orderBy(desc(a.lastSeen), desc(a.id))
      .limit(ALERT_PAGE_SIZE)
      .offset((f.page - 1) * ALERT_PAGE_SIZE),
    db().select({ n: count() }).from(a).where(where),
  ]);
  const n = total?.n ?? 0;
  return { alerts: rows, total: n, page: f.page, pages: Math.max(1, Math.ceil(n / ALERT_PAGE_SIZE)) };
}

/** One alert with its timeline (oldest first) and its evidence (the newest 100 linked events). */
export async function alertDetail(id: number) {
  const [alert] = await db().select().from(a).where(eq(a.id, id));
  if (!alert) return null;
  const [activity, links] = await Promise.all([
    db()
      .select()
      .from(schema.alertActivity)
      .where(eq(schema.alertActivity.alertId, id))
      .orderBy(asc(schema.alertActivity.createdAt), asc(schema.alertActivity.id)),
    db()
      .select({ eventId: schema.alertEvent.eventId })
      .from(schema.alertEvent)
      .where(eq(schema.alertEvent.alertId, id))
      .orderBy(desc(schema.alertEvent.eventId))
      .limit(100),
  ]);
  const events = links.length
    ? await db()
        .select()
        .from(schema.event)
        .where(
          inArray(
            schema.event.id,
            links.map((l) => l.eventId),
          ),
        )
        .orderBy(desc(schema.event.id))
    : [];
  return { alert, activity, events: events.map(toView) };
}

/** Not-resolved alerts by severity: for the Overview card and the sidebar badge. */
export async function activeAlertCounts(): Promise<Record<Severity, number> & { total: number }> {
  const rows = await db()
    .select({ severity: a.severity, n: count() })
    .from(a)
    .where(ne(a.status, "resolved"))
    .groupBy(a.severity);
  const by = { low: 0, medium: 0, high: 0 };
  for (const r of rows) by[r.severity] = r.n;
  return { ...by, total: by.low + by.medium + by.high };
}

export async function latestActiveAlerts(limit: number) {
  return db().select().from(a).where(ne(a.status, "resolved")).orderBy(desc(a.lastSeen)).limit(limit);
}
