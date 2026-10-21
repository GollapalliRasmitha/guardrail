import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { SourceBadge } from "@/components/events/EventBadges";
import { SeverityBadge } from "@/components/ui/SeverityBadge";
import type { AlertRow } from "@/lib/db/schema";
import { ruleFor } from "@/lib/detection/rules";
import { formatTime } from "@/lib/format";
import { StatusBadge } from "./StatusBadge";

/** Alerts as a list of links (one layout for phone and desktop: it wraps instead of switching to a table). */
export function AlertList({ alerts, label }: { alerts: AlertRow[]; label: string }) {
  return (
    <ul className="divide-y divide-line" aria-label={label}>
      {alerts.map((alert) => {
        const rule = ruleFor(alert.ruleId);
        return (
          <li key={alert.id}>
            <Link
              href={`/dashboard/alerts/${alert.id}`}
              className="group flex items-center gap-3 rounded-lg px-2 py-3 hover:bg-panel-2"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <SeverityBadge severity={alert.severity} />
                  <StatusBadge status={alert.status} />
                  <span className="font-mono text-xs text-muted">{rule.mitre.id}</span>
                </div>
                <p className="mt-1.5 font-medium [overflow-wrap:anywhere] text-text">{alert.title}</p>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                  <SourceBadge source={alert.source} />
                  <span>
                    {alert.eventCount} event{alert.eventCount === 1 ? "" : "s"}
                  </span>
                  <span aria-hidden>·</span>
                  <span>
                    last <time dateTime={alert.lastSeen.toISOString()}>{formatTime(alert.lastSeen)}</time> IST
                  </span>
                </p>
              </div>
              <ChevronRight className="size-4 shrink-0 text-muted group-hover:text-accent" aria-hidden />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
