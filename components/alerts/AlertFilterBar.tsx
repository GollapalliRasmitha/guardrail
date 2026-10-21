import { Filter } from "lucide-react";
import Link from "next/link";
import { buttonClass } from "@/components/ui/Button";
import type { AlertFilters } from "@/lib/alerts/filters";
import { SOURCE_INFO, SOURCES } from "@/lib/events/types";

const VIEWS = [
  ["active", "Open + acknowledged"],
  ["open", "Open"],
  ["acknowledged", "Acknowledged"],
  ["resolved", "Resolved"],
  ["all", "All"],
] as const;

/** A plain GET form, like the events filters: works without JavaScript, every view is a link. */
export function AlertFilterBar({ filters }: { filters: AlertFilters }) {
  const changed = filters.view !== "active" || filters.severity || filters.source;
  return (
    <form method="get" action="/dashboard/alerts" className="mb-5 grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
      <div>
        <label htmlFor="a-view" className="mb-1 block text-xs text-muted">
          Status
        </label>
        <select id="a-view" name="view" defaultValue={filters.view} className="input">
          {VIEWS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="a-severity" className="mb-1 block text-xs text-muted">
          Severity
        </label>
        <select id="a-severity" name="severity" defaultValue={filters.severity ?? ""} className="input">
          <option value="">Any severity</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </div>
      <div>
        <label htmlFor="a-source" className="mb-1 block text-xs text-muted">
          Source
        </label>
        <select id="a-source" name="source" defaultValue={filters.source ?? ""} className="input">
          <option value="">All sources</option>
          {SOURCES.map((s) => (
            <option key={s} value={s}>
              {SOURCE_INFO[s].name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-end gap-2">
        <button type="submit" className={buttonClass("primary", "w-full sm:w-auto")}>
          <Filter className="size-4" aria-hidden /> Filter
        </button>
        {changed && (
          <Link href="/dashboard/alerts" className={buttonClass("ghost")}>
            Clear
          </Link>
        )}
      </div>
    </form>
  );
}
