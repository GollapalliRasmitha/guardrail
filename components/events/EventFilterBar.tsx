import { Search } from "lucide-react";
import Link from "next/link";
import { buttonClass } from "@/components/ui/Button";
import type { EventFilters } from "@/lib/events/filters";
import { EVENT_INFO, EVENT_TYPES, SOURCE_INFO, SOURCES } from "@/lib/events/types";

/**
 * A plain GET form: submitting it just changes the URL (?source=…&type=…&q=…). It works without JavaScript,
 * and every filtered view is a link you can bookmark or share.
 */
export function EventFilterBar({ filters }: { filters: EventFilters }) {
  const active = Boolean(filters.source || filters.type || filters.q);
  return (
    <form
      method="get"
      action="/dashboard/events"
      role="search"
      className="mb-5 grid gap-3 sm:grid-cols-[1fr_1fr_2fr_auto]"
    >
      <div>
        <label htmlFor="f-source" className="mb-1 block text-xs text-muted">
          Source
        </label>
        <select id="f-source" name="source" defaultValue={filters.source ?? ""} className="input">
          <option value="">All sources</option>
          {SOURCES.map((s) => (
            <option key={s} value={s}>
              {SOURCE_INFO[s].name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="f-type" className="mb-1 block text-xs text-muted">
          Event
        </label>
        <select id="f-type" name="type" defaultValue={filters.type ?? ""} className="input">
          <option value="">All events</option>
          {EVENT_TYPES.map((t) => (
            <option key={t} value={t}>
              {EVENT_INFO[t].label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="f-q" className="mb-1 block text-xs text-muted">
          Search IP, account or path
        </label>
        <input
          id="f-q"
          name="q"
          type="search"
          defaultValue={filters.q ?? ""}
          placeholder="e.g. 203.0.113 or wp-admin"
          className="input"
          maxLength={100}
        />
      </div>
      <div className="flex items-end gap-2">
        <button type="submit" className={buttonClass("primary", "w-full sm:w-auto")}>
          <Search className="size-4" aria-hidden /> Filter
        </button>
        {active && (
          <Link href="/dashboard/events" className={buttonClass("ghost")}>
            Clear
          </Link>
        )}
      </div>
    </form>
  );
}
