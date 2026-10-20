import { z } from "zod";
import { EVENT_TYPES, SOURCES } from "./types";

// Filters live in the URL (?source=homehaat&type=login_failed&q=wp-admin&page=2), so a view can be bookmarked,
// shared, and kept on back/forward. Anything invalid in the URL is simply ignored, never an error page.

export const PAGE_SIZE = 25;

const one = (v: unknown) => (Array.isArray(v) ? v[0] : v);

export const eventFiltersSchema = z.object({
  source: z.preprocess(one, z.enum(SOURCES).optional().catch(undefined)),
  type: z.preprocess(one, z.enum(EVENT_TYPES).optional().catch(undefined)),
  q: z
    .preprocess(one, z.string().trim().max(100).optional().catch(undefined))
    .transform((v) => v || undefined),
  page: z.preprocess(one, z.coerce.number().int().min(1).max(10_000).catch(1)).default(1),
});

export type EventFilters = z.infer<typeof eventFiltersSchema>;

/** The part of the filters that decides which events are shown (no page). */
export type ViewFilters = Partial<Pick<EventFilters, "source" | "type" | "q">>;

export function parseEventFilters(params: Record<string, string | string[] | undefined>): EventFilters {
  return eventFiltersSchema.parse(params);
}

/** Back to a query string, for links (pagination keeps the filters). */
export function filtersToQuery(filters: Partial<EventFilters>): string {
  const params = new URLSearchParams();
  if (filters.source) params.set("source", filters.source);
  if (filters.type) params.set("type", filters.type);
  if (filters.q) params.set("q", filters.q);
  if (filters.page && filters.page > 1) params.set("page", String(filters.page));
  const text = params.toString();
  return text ? `?${text}` : "";
}

/** The event shape sent to the browser (JSON-safe: dates as ISO strings). */
export type EventView = {
  id: number;
  source: (typeof SOURCES)[number];
  type: (typeof EVENT_TYPES)[number];
  occurredAt: string;
  ip: string | null;
  country: string | null;
  actor: string | null;
  path: string | null;
  method: string | null;
  statusCode: number | null;
};

/**
 * Does a live event belong in the current view? The same rules as the database query, so a live update never
 * shows an event the page's filters would hide.
 */
export function matchesFilters(e: EventView, f: ViewFilters): boolean {
  if (f.source && e.source !== f.source) return false;
  if (f.type && e.type !== f.type) return false;
  if (f.q) {
    const needle = f.q.toLowerCase();
    return [e.actor, e.path, e.ip].some((field) => field?.toLowerCase().includes(needle));
  }
  return true;
}
