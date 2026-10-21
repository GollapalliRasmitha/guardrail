import { Bell, SearchX } from "lucide-react";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { AlertFilterBar } from "@/components/alerts/AlertFilterBar";
import { AlertList } from "@/components/alerts/AlertList";
import { RefreshOnEvents } from "@/components/live/RefreshOnEvents";
import { PageHeader } from "@/components/shell/AppShell";
import { buttonClass } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { Panel } from "@/components/ui/Panel";
import { alertFiltersToQuery, parseAlertFilters } from "@/lib/alerts/filters";
import { listAlerts } from "@/lib/alerts/query";
import { requireActiveSession } from "@/lib/auth/guards";
import { RULES } from "@/lib/detection/rules";

export const metadata: Metadata = { title: "Alerts" };

export default async function AlertsPage({ searchParams }: PageProps<"/dashboard/alerts">) {
  await requireActiveSession();
  const filters = parseAlertFilters(await searchParams);
  const result = await listAlerts(filters);
  const filtered = filters.view !== "active" || filters.severity || filters.source;

  return (
    <>
      <RefreshOnEvents />
      <PageHeader eyebrow="Detection" title="Alerts" />
      <AlertFilterBar filters={filters} />
      <Panel>
        {result.alerts.length > 0 ? (
          <AlertList alerts={result.alerts} label="Alerts, most recent first" />
        ) : filtered ? (
          <EmptyState
            icon={<SearchX className="size-6" />}
            title="No alerts match"
            action={
              <Link href="/dashboard/alerts" className={buttonClass("ghost")}>
                Show open alerts
              </Link>
            }
          >
            Nothing with these filters. New alerts appear here by themselves.
          </EmptyState>
        ) : (
          <EmptyState icon={<Bell className="size-6" />} title="No open alerts">
            <p>GuardRail is watching for:</p>
            <ul className="mt-2 space-y-1 text-left">
              {RULES.map((r) => (
                <li key={r.id}>
                  <span className="font-mono text-xs text-accent">{r.mitre.id}</span> {r.name}
                </li>
              ))}
            </ul>
          </EmptyState>
        )}
        <Pagination
          page={result.page}
          pages={result.pages}
          total={result.total}
          noun="alerts"
          hrefFor={(page) => `/dashboard/alerts${alertFiltersToQuery({ ...filters, page })}` as Route}
        />
      </Panel>
    </>
  );
}
