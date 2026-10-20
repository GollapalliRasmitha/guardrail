import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { parseEventFilters, type EventView } from "@/lib/events/filters";
import { eventsAfter, listEvents } from "@/lib/events/query";
import { jsonError } from "@/lib/http/request";
import { parseCursor } from "@/lib/live/sse";

export type EventsPageResponse = { events: EventView[]; total: number; page: number; pages: number };
export type EventsAfterResponse = { events: EventView[]; cursor: number };

/**
 * GET /api/events?source=&type=&q=&page=   one page of events (typed, for scripts and the demo)
 * GET /api/events?after=123                events newer than 123 (the live feed's fallback when SSE fails)
 */
export async function GET(request: Request) {
  const current = await getCurrentSession();
  if (!current || current.state !== "active") return jsonError(401, "signed_out", "Please sign in.");

  const params = Object.fromEntries(new URL(request.url).searchParams);
  const headers = { "Cache-Control": "no-store" };

  const after = parseCursor(null, params.after ?? null);
  if (after !== null) {
    const events = await eventsAfter(after);
    const cursor = events.length ? events[events.length - 1]!.id : after;
    return NextResponse.json<EventsAfterResponse>({ events, cursor }, { headers });
  }
  return NextResponse.json<EventsPageResponse>(await listEvents(parseEventFilters(params)), { headers });
}
