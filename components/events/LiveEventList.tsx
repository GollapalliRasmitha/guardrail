"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { useLive } from "@/components/live/LiveProvider";
import { filtersToQuery, matchesFilters, type EventView, type ViewFilters } from "@/lib/events/filters";
import { EventList } from "./EventList";

const FRESH_MS = 2_500;

/**
 * A list that grows live. On the first page, matching events slide in at the top (and glow briefly).
 * On later pages the rows stay put (they'd shift under the reader) and a link says how many new ones arrived.
 */
export function LiveEventList({
  initial,
  filters = {},
  live = true,
  max = 100,
  caption,
  empty,
}: {
  initial: EventView[];
  filters?: ViewFilters;
  live?: boolean;
  max?: number;
  caption: string;
  empty: ReactNode;
}) {
  const { subscribe } = useLive();
  const [events, setEvents] = useState(initial);
  const [freshIds, setFreshIds] = useState<ReadonlySet<number>>(new Set());
  const [waiting, setWaiting] = useState(0); // new events not shown (later pages)
  const { source, type, q } = filters;

  useEffect(
    () =>
      subscribe((incoming) => {
        const matching = incoming.filter((e) => matchesFilters(e, { source, type, q })).reverse(); // newest first
        if (matching.length === 0) return;
        if (!live) {
          setWaiting((n) => n + matching.length);
          return;
        }
        setEvents((current) => {
          const known = new Set(current.map((e) => e.id));
          return [...matching.filter((e) => !known.has(e.id)), ...current].slice(0, max);
        });
        const ids = matching.map((e) => e.id);
        setFreshIds((current) => new Set([...current, ...ids]));
        setTimeout(
          () => setFreshIds((current) => new Set([...current].filter((id) => !ids.includes(id)))),
          FRESH_MS,
        );
      }),
    [subscribe, live, max, source, type, q],
  );

  return (
    <div>
      {/* Screen readers hear a short note instead of every new row. */}
      <p className="sr-only" aria-live="polite">
        {freshIds.size > 0 ? `${freshIds.size} new event${freshIds.size === 1 ? "" : "s"}` : ""}
      </p>
      {waiting > 0 && (
        <Link
          href={`/dashboard/events${filtersToQuery({ source, type, q })}`}
          className="mb-4 flex min-h-11 items-center justify-center rounded-lg border border-accent/40 bg-accent/10 px-4 text-sm text-accent"
        >
          {waiting} new event{waiting === 1 ? "" : "s"} · go to the newest
        </Link>
      )}
      {events.length === 0 ? empty : <EventList events={events} freshIds={freshIds} caption={caption} />}
    </div>
  );
}
