import "server-only";
import { and, count, eq, gt, lt } from "drizzle-orm";
import { privacyHash } from "@/lib/crypto";
import { db, schema } from "@/lib/db";
import { env } from "@/lib/env";
import { SOURCES, type SourceId } from "@/lib/events/types";
import type { NewEvent } from "./schema";

export const INGEST_RATE_PER_MINUTE = 600; // requests per source per minute (each can carry 50 events)

export function isSource(value: string | null): value is SourceId {
  return value !== null && (SOURCES as readonly string[]).includes(value);
}

/** The source's signing secret, or "" if it isn't configured (then every request from it is refused). */
export function secretFor(source: SourceId): string {
  const e = env();
  return (source === "homehaat" ? e.INGEST_SECRET_HOMEHAAT : e.INGEST_SECRET_OPPORA) ?? "";
}

/**
 * Replay protection: record the nonce. Returns false if this source already used it.
 * `ON CONFLICT DO NOTHING` + the primary key make this safe even when two copies arrive at the same instant:
 * Postgres lets exactly one INSERT win.
 */
export async function claimNonce(source: SourceId, nonce: string): Promise<boolean> {
  const inserted = await db()
    .insert(schema.ingestNonce)
    .values({ source, nonce: nonce.toLowerCase() })
    .onConflictDoNothing()
    .returning({ nonce: schema.ingestNonce.nonce });
  return inserted.length === 1;
}

/** Requests from this source in the last minute (the nonce table doubles as a request log). */
export async function recentRequestCount(source: SourceId): Promise<number> {
  const [row] = await db()
    .select({ n: count() })
    .from(schema.ingestNonce)
    .where(
      and(
        eq(schema.ingestNonce.source, source),
        gt(schema.ingestNonce.createdAt, new Date(Date.now() - 60_000)),
      ),
    );
  return row?.n ?? 0;
}

export async function insertEvents(source: SourceId, events: NewEvent[]): Promise<number[]> {
  if (events.length === 0) return [];
  const rows = await db()
    .insert(schema.event)
    .values(events.map((e) => ({ ...e, source, ipHash: e.ip ? privacyHash(e.ip) : null })))
    .returning({ id: schema.event.id });
  return rows.map((r) => r.id);
}

/** Housekeeping: nonces older than 10 minutes can't be replayed anyway (their timestamp is too old). */
export async function pruneNonces() {
  await db()
    .delete(schema.ingestNonce)
    .where(lt(schema.ingestNonce.createdAt, new Date(Date.now() - 10 * 60_000)));
}
