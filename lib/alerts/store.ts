import "server-only";
import { and, desc, eq, inArray, isNotNull, ne, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import type { AlertRow } from "@/lib/db/schema";
import type { Finding, Rule } from "@/lib/detection/rules";
import type { SourceId } from "@/lib/events/types";
import { canMove } from "./status";
import { SEVERITY_RANK, type AlertStatus } from "./types";

const a = schema.alert;

export type UpsertResult = { alert: AlertRow; created: boolean; newEvents: number; severityRaised: boolean };

/**
 * [KEY LOGIC] Turn a rule's finding into an alert: create it, or update the open one for the same attack.
 *
 * - "Same attack" = same group key (rule + account / IP / site). Postgres keeps at most ONE not-resolved alert per
 *   group key (partial unique index), so two requests detecting the same attack at once can't make two alerts:
 *   the INSERT uses ON CONFLICT DO NOTHING, and the loser simply reads and updates the winner's alert.
 * - Everything happens in one transaction with the alert row locked (FOR UPDATE), so counts never get lost.
 * - Evidence: each event is linked once (primary key on alert + event); event_count is the number of links.
 * - Severity only goes up (low → medium → high), never down, and every change goes on the timeline.
 */
export async function upsertAlert(
  rule: Rule,
  groupKey: string,
  source: SourceId,
  finding: Finding,
  eventTimes: Date[],
) {
  return db().transaction(async (tx): Promise<UpsertResult> => {
    const first = new Date(Math.min(...eventTimes.map((t) => t.getTime())));
    const last = new Date(Math.max(...eventTimes.map((t) => t.getTime())));

    const [inserted] = await tx
      .insert(a)
      .values({
        ruleId: rule.id,
        groupKey,
        source,
        severity: finding.severity,
        title: finding.title,
        subject: finding.subject,
        firstSeen: first,
        lastSeen: last,
      })
      .onConflictDoNothing({ target: a.groupKey, where: sql`${a.status} <> 'resolved'` })
      .returning();

    const [current] = inserted
      ? [inserted]
      : await tx
          .select()
          .from(a)
          .where(and(eq(a.groupKey, groupKey), ne(a.status, "resolved")))
          .for("update");
    if (!current) throw new Error(`Alert for ${groupKey} vanished during upsert`);

    const linked = await tx
      .insert(schema.alertEvent)
      .values(finding.eventIds.map((eventId) => ({ alertId: current.id, eventId })))
      .onConflictDoNothing()
      .returning({ eventId: schema.alertEvent.eventId });

    const severityRaised = !inserted && SEVERITY_RANK[finding.severity] > SEVERITY_RANK[current.severity];
    const [updated] = await tx
      .update(a)
      .set({
        eventCount: sql`${a.eventCount} + ${linked.length}`,
        lastSeen: sql`greatest(${a.lastSeen}, ${last})`,
        firstSeen: sql`least(${a.firstSeen}, ${first})`,
        ...(severityRaised ? { severity: finding.severity } : {}),
        updatedAt: new Date(),
      })
      .where(eq(a.id, current.id))
      .returning();

    const timeline: (typeof schema.alertActivity.$inferInsert)[] = [];
    if (inserted)
      timeline.push({
        alertId: current.id,
        kind: "created",
        detail: { severity: finding.severity, events: linked.length },
      });
    else if (linked.length > 0 && !(await mergedIntoLastEventsEntry(tx, current.id, linked.length, last)))
      timeline.push({
        alertId: current.id,
        kind: "events",
        detail: { added: linked.length, until: last.toISOString() },
      });
    if (severityRaised)
      timeline.push({
        alertId: current.id,
        kind: "severity",
        detail: { from: current.severity, to: finding.severity },
      });
    if (timeline.length) await tx.insert(schema.alertActivity).values(timeline);

    return { alert: updated!, created: Boolean(inserted), newEvents: linked.length, severityRaised };
  });
}

type Tx = Parameters<Parameters<ReturnType<typeof db>["transaction"]>[0]>[0];
const MERGE_WINDOW_MS = 10 * 60_000;

/**
 * A burst of events would otherwise put dozens of "2 more events" lines on the timeline. If the newest timeline entry
 * is already "more events" from the last 10 minutes, add to its count instead ("15 more events, up to 11:54").
 */
async function mergedIntoLastEventsEntry(
  tx: Tx,
  alertId: number,
  added: number,
  until: Date,
): Promise<boolean> {
  const [latest] = await tx
    .select()
    .from(schema.alertActivity)
    .where(eq(schema.alertActivity.alertId, alertId))
    .orderBy(desc(schema.alertActivity.id))
    .limit(1);
  if (!latest || latest.kind !== "events" || Date.now() - latest.createdAt.getTime() > MERGE_WINDOW_MS)
    return false;
  await tx
    .update(schema.alertActivity)
    .set({ detail: { added: Number(latest.detail.added ?? 0) + added, until: until.toISOString() } })
    .where(eq(schema.alertActivity.id, latest.id));
  return true;
}

/**
 * When the last alert for this group was resolved. Events from before that are "dealt with", so the engine ignores
 * them: resolving a brute-force alert and then seeing one more stray failure must not instantly re-raise it.
 */
export async function lastResolvedAt(groupKey: string): Promise<Date | null> {
  const [row] = await db()
    .select({ at: a.resolvedAt })
    .from(a)
    .where(and(eq(a.groupKey, groupKey), isNotNull(a.resolvedAt)))
    .orderBy(desc(a.resolvedAt))
    .limit(1);
  return row?.at ?? null;
}

export type StatusChange =
  | { ok: true; alert: AlertRow }
  | { ok: false; reason: "not_found" | "not_allowed" | "newer_open_alert"; newerId?: number };

/** Change an alert's status (checked against the allowed moves) and put it on the timeline. */
export async function changeStatus(id: number, to: AlertStatus): Promise<StatusChange> {
  return db().transaction(async (tx) => {
    const [current] = await tx.select().from(a).where(eq(a.id, id)).for("update");
    if (!current) return { ok: false, reason: "not_found" };
    if (!canMove(current.status, to)) return { ok: false, reason: "not_allowed" };

    if (current.status === "resolved") {
      // Reopening: only if no newer alert is already open for the same attack (one active alert per group).
      const [newer] = await tx
        .select({ id: a.id })
        .from(a)
        .where(and(eq(a.groupKey, current.groupKey), ne(a.status, "resolved")));
      if (newer) return { ok: false, reason: "newer_open_alert", newerId: newer.id };
    }

    const [updated] = await tx
      .update(a)
      .set({ status: to, resolvedAt: to === "resolved" ? new Date() : null, updatedAt: new Date() })
      .where(eq(a.id, id))
      .returning();
    await tx
      .insert(schema.alertActivity)
      .values({ alertId: id, kind: "status", detail: { from: current.status, to } });
    return { ok: true, alert: updated! };
  });
}

export async function addNote(id: number, note: string): Promise<boolean> {
  const [exists] = await db().select({ id: a.id }).from(a).where(eq(a.id, id));
  if (!exists) return false;
  await db().insert(schema.alertActivity).values({ alertId: id, kind: "note", note });
  await db().update(a).set({ updatedAt: new Date() }).where(eq(a.id, id));
  return true;
}

/** Record something on the timeline (used by the email step). */
export async function addActivity(
  alertId: number,
  kind: (typeof schema.alertActivity.$inferInsert)["kind"],
  detail: Record<string, string | number | null> = {},
) {
  await db().insert(schema.alertActivity).values({ alertId, kind, detail });
}

export async function eventsByIds(ids: number[]) {
  if (ids.length === 0) return [];
  return db().select().from(schema.event).where(inArray(schema.event.id, ids));
}
