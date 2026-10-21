import "server-only";
import { and, desc, eq, gte, inArray, isNull, lte } from "drizzle-orm";
import { lastResolvedAt, upsertAlert } from "@/lib/alerts/store";
import { notifyIfNeeded } from "@/lib/alerts/notify";
import { db, schema } from "@/lib/db";
import type { EventRow } from "@/lib/db/schema";
import { RULES, type Rule, type RuleEvent } from "./rules";

// [KEY LOGIC] The detection engine: runs the rules on newly arrived events and turns findings into alerts.
// It's called by POST /api/ingest *after* the response has been sent (Next.js after()), so HomeHaat never waits
// for detection or emails, and its 2-second timeout is never at risk.

const HISTORY_LIMIT = 500; // the newest 500 matching events are plenty for any rule

const e = schema.event;

export function toRuleEvent(row: EventRow): RuleEvent {
  return {
    id: row.id,
    type: row.type,
    source: row.source,
    occurredAt: row.occurredAt,
    ip: row.ip,
    ipHash: row.ipHash,
    actor: row.actor,
    actorId: row.actorId,
    country: row.country,
  };
}

/** Earlier events with the same key as the trigger, inside the rule's window (and after the last "resolved"). */
async function historyFor(rule: Rule, trigger: RuleEvent, since: Date): Promise<RuleEvent[]> {
  const sameKey =
    rule.keyBy === "ip"
      ? eq(e.ipHash, trigger.ipHash!)
      : rule.keyBy === "source"
        ? eq(e.source, trigger.source)
        : trigger.actorId
          ? eq(e.actorId, trigger.actorId)
          : and(isNull(e.actorId), eq(e.actor, trigger.actor!));
  const rows = await db()
    .select()
    .from(e)
    .where(
      and(
        inArray(e.type, [...rule.watches]),
        sameKey,
        gte(e.occurredAt, since),
        lte(e.occurredAt, trigger.occurredAt),
      ),
    )
    .orderBy(desc(e.occurredAt))
    .limit(HISTORY_LIMIT);
  return rows.reverse().map(toRuleEvent); // oldest first, ending with the trigger
}

/**
 * Run every rule that cares about these events.
 * 1. Load the new events; for each rule that watches their type, work out the key (account / IP / site).
 * 2. One evaluation per rule + key, using the newest event as the trigger (a batch of 50 failed logins for one
 *    account is ONE check, not 50).
 * 3. Load that key's history in the rule's window, ignoring anything before the last time I resolved this attack.
 * 4. A finding becomes an alert (created or updated: upsertAlert), then maybe an email.
 * Each check is isolated: one failing never stops the others.
 */
export async function detect(eventIds: number[]): Promise<{ checked: number; alerts: number }> {
  if (eventIds.length === 0) return { checked: 0, alerts: 0 };
  const rows = await db().select().from(e).where(inArray(e.id, eventIds));
  const newest = new Map<string, { rule: Rule; trigger: RuleEvent }>();

  for (const row of rows.sort((x, y) => x.occurredAt.getTime() - y.occurredAt.getTime())) {
    const event = toRuleEvent(row);
    for (const rule of RULES) {
      if (!rule.watches.includes(event.type)) continue;
      const key = rule.keyOf(event);
      if (key) newest.set(`${rule.id}:${key}`, { rule, trigger: event }); // later events overwrite earlier ones
    }
  }

  let alerts = 0;
  for (const [groupKey, { rule, trigger }] of newest) {
    try {
      const windowStart = new Date(trigger.occurredAt.getTime() - rule.windowMs);
      const resolved = await lastResolvedAt(groupKey);
      const since = resolved && resolved > windowStart ? resolved : windowStart;
      const history = await historyFor(rule, trigger, since);
      const finding = rule.evaluate(trigger, history);
      if (!finding) continue;

      const times = history.filter((h) => finding.eventIds.includes(h.id)).map((h) => h.occurredAt);
      const result = await upsertAlert(
        rule,
        groupKey,
        trigger.source,
        finding,
        times.length ? times : [trigger.occurredAt],
      );
      alerts += 1;
      await notifyIfNeeded(result.alert);
    } catch (error) {
      console.error(`Detection failed for ${groupKey}:`, error instanceof Error ? error.message : error);
    }
  }
  return { checked: newest.size, alerts };
}
