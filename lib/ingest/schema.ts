import { z } from "zod";
import { EVENT_TYPES, META_KEYS, type EventType } from "@/lib/events/types";

export const MAX_EVENTS_PER_BATCH = 50;
const MAX_AGE_MS = 7 * 86_400_000; // the sender's outbox may deliver late, but not a week late
const MAX_FUTURE_MS = 5 * 60_000;

const metaValue = z.union([z.string().max(200), z.number().finite(), z.boolean()]);

const eventSchema = z.object({
  type: z.enum(EVENT_TYPES),
  // the sender's id for this event (idempotency key): a retry with the same uid is stored once
  uid: z
    .string()
    .regex(/^[0-9a-f]{32}$/)
    .optional(),
  occurred_at: z.iso.datetime({ offset: true }),
  ip: z.union([z.ipv4(), z.ipv6()]).optional(),
  actor: z.string().min(1).max(254).optional(),
  // keyed hash of the full email, made by the sender: lets rules tell accounts apart without the email
  actor_id: z
    .string()
    .regex(/^[0-9a-f]{16,64}$/)
    .optional(),
  path: z.string().max(2048).optional(),
  method: z.string().max(10).optional(),
  status_code: z.number().int().min(100).max(599).optional(),
  user_agent: z.string().max(2000).optional(),
  country: z
    .string()
    .regex(/^[A-Za-z]{2}$/)
    .optional(),
  meta: z.record(z.string(), metaValue).optional(),
});

const batchSchema = z.object({ events: z.array(z.unknown()).min(1).max(MAX_EVENTS_PER_BATCH) });

/** One event, cleaned and ready for the database. */
export type NewEvent = {
  type: EventType;
  uid: string | null;
  occurredAt: Date;
  ip: string | null;
  actor: string | null;
  actorId: string | null;
  path: string | null;
  method: string | null;
  statusCode: number | null;
  userAgent: string | null;
  country: string | null;
  meta: Record<string, string | number | boolean>;
};

export type BatchResult =
  | { ok: true; accepted: NewEvent[]; rejected: { index: number; reason: string }[] }
  | { ok: false; reason: string };

/**
 * Privacy: never store a full email or username. "rasmitha@gmail.com" -> "ra****@gmail.com".
 * Done here even though the senders mask too (defence in depth: one forgotten call can't leak data).
 */
export function maskActor(actor: string): string {
  const value = actor.trim().toLowerCase();
  if (value.includes("****")) return value;
  const at = value.lastIndexOf("@");
  if (at > 0) return `${value.slice(0, Math.min(2, at))}****${value.slice(at)}`;
  return `${value.slice(0, 2)}****`;
}

/** Only the path is kept: query strings often carry tokens (password-reset links, session ids). */
function cleanPath(path: string): string {
  return path.split(/[?#]/, 1)[0]!.slice(0, 300);
}

function pickMeta(meta: Record<string, string | number | boolean> | undefined) {
  const out: Record<string, string | number | boolean> = {};
  for (const key of META_KEYS) if (meta && key in meta) out[key] = meta[key]!;
  return out;
}

/**
 * Check a batch. A wrong SHAPE refuses the whole batch (400). Inside a good batch, each event is checked on its
 * own: good ones are kept, bad ones are reported by index, so one broken event can't block the others.
 */
export function parseBatch(body: unknown, now: Date): BatchResult {
  const batch = batchSchema.safeParse(body);
  if (!batch.success)
    return { ok: false, reason: `Body must be {"events": [1..${MAX_EVENTS_PER_BATCH} events]}` };

  const accepted: NewEvent[] = [];
  const rejected: { index: number; reason: string }[] = [];
  batch.data.events.forEach((raw, index) => {
    const parsed = eventSchema.safeParse(raw);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      rejected.push({ index, reason: `${issue?.path.join(".") || "event"}: ${issue?.message ?? "invalid"}` });
      return;
    }
    const e = parsed.data;
    const occurredAt = new Date(e.occurred_at);
    const age = now.getTime() - occurredAt.getTime();
    if (age > MAX_AGE_MS || age < -MAX_FUTURE_MS) {
      rejected.push({ index, reason: "occurred_at: too old or in the future" });
      return;
    }
    accepted.push({
      type: e.type,
      uid: e.uid ?? null,
      occurredAt,
      ip: e.ip ?? null,
      actor: e.actor ? maskActor(e.actor) : null,
      actorId: e.actor_id ?? null,
      path: e.path ? cleanPath(e.path) : null,
      method: e.method ? e.method.toUpperCase() : null,
      statusCode: e.status_code ?? null,
      userAgent: e.user_agent ? e.user_agent.slice(0, 200) : null,
      country: e.country ? e.country.toUpperCase() : null,
      meta: pickMeta(e.meta),
    });
  });
  return { ok: true, accepted, rejected };
}
