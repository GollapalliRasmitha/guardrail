import "server-only";
import { and, count, desc, eq, gt, ilike, max, or, sql, type SQL } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import type { EventRow } from "@/lib/db/schema";
import { PAGE_SIZE, type EventFilters, type EventView, type ViewFilters } from "./filters";
import { SOURCES, type SourceId } from "./types";

const e = schema.event;

export function toView(row: EventRow): EventView {
  return {
    id: row.id,
    source: row.source,
    type: row.type,
    occurredAt: row.occurredAt.toISOString(),
    ip: row.ip,
    country: row.country,
    actor: row.actor,
    path: row.path,
    method: row.method,
    statusCode: row.statusCode,
  };
}

/** Escape % and _ so a search for "50%" means the text "50%", not "50 followed by anything". */
function likePattern(text: string) {
  return `%${text.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

function whereFor(f: ViewFilters): SQL | undefined {
  const parts: (SQL | undefined)[] = [];
  if (f.source) parts.push(eq(e.source, f.source));
  if (f.type) parts.push(eq(e.type, f.type));
  if (f.q) {
    const pattern = likePattern(f.q);
    // host(ip) turns the inet value into plain text ("203.0.113.9"), so IPs are searchable too.
    parts.push(or(ilike(e.actor, pattern), ilike(e.path, pattern), sql`host(${e.ip}) ilike ${pattern}`));
  }
  return and(...parts);
}

/** One page of events, newest first, plus the total for "page 2 of 7". */
export async function listEvents(f: EventFilters) {
  const where = whereFor(f);
  const [rows, [total]] = await Promise.all([
    db()
      .select()
      .from(e)
      .where(where)
      .orderBy(desc(e.id))
      .limit(PAGE_SIZE)
      .offset((f.page - 1) * PAGE_SIZE),
    db().select({ n: count() }).from(e).where(where),
  ]);
  const n = total?.n ?? 0;
  return { events: rows.map(toView), total: n, page: f.page, pages: Math.max(1, Math.ceil(n / PAGE_SIZE)) };
}

/** Events newer than `cursor`, oldest first (the order they should appear live). Uses the primary key index. */
export async function eventsAfter(cursor: number, limit = 100): Promise<EventView[]> {
  const rows = await db().select().from(e).where(gt(e.id, cursor)).orderBy(e.id).limit(limit);
  return rows.map(toView);
}

export async function latestEventId(): Promise<number> {
  const [row] = await db()
    .select({ id: max(e.id) })
    .from(e);
  return row?.id ?? 0;
}

export async function latestEvents(limit: number): Promise<EventView[]> {
  const rows = await db().select().from(e).orderBy(desc(e.id)).limit(limit);
  return rows.map(toView);
}

/** Per source: when it last sent something, events in the last 24 h, and "online" (sent something in 24 h). */
export async function sourceStats() {
  const dayAgo = new Date(Date.now() - 86_400_000);
  const rows = await db()
    .select({
      source: e.source,
      lastSeen: max(e.receivedAt),
      last24h: sql<number>`count(*) filter (where ${e.receivedAt} > ${dayAgo})`.mapWith(Number),
    })
    .from(e)
    .groupBy(e.source);
  return Object.fromEntries(
    SOURCES.map((s) => {
      const row = rows.find((r) => r.source === s);
      const lastSeen = row?.lastSeen ?? null;
      return [s, { lastSeen, last24h: row?.last24h ?? 0, online: lastSeen !== null && lastSeen > dayAgo }];
    }),
  ) as Record<SourceId, { lastSeen: Date | null; last24h: number; online: boolean }>;
}
