import { Activity, ArrowRight, Bell, KeyRound, Server } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { AlertList } from "@/components/alerts/AlertList";
import { EventsChart, type ChartBucket } from "@/components/charts/EventsChart";
import { TopIps, type TopIpRow } from "@/components/charts/TopIps";
import { LiveEventList } from "@/components/events/LiveEventList";
import { SourceStatus } from "@/components/events/SourceStatus";
import { PageHeader } from "@/components/shell/AppShell";
import type { Base } from "@/components/shell/nav";
import { EmptyState } from "@/components/ui/EmptyState";
import { Mono } from "@/components/ui/Mono";
import { Panel } from "@/components/ui/Panel";
import { StatCard } from "@/components/ui/StatCard";
import type { Severity } from "@/lib/alerts/types";
import type { AlertRow } from "@/lib/db/schema";
import type { EventView } from "@/lib/events/filters";
import { SOURCE_INFO, SOURCES, type SourceId } from "@/lib/events/types";
import { formatCount } from "@/lib/format";

export type OverviewData = {
  stats: {
    events24h: number;
    sourcesOnline: number;
    failedSignIns24h: number;
    sources: Record<SourceId, { lastSeen: Date | null; online: boolean }>;
  };
  latest: EventView[];
  alertCounts: Record<Severity, number> & { total: number };
  alerts: AlertRow[];
  buckets: ChartBucket[];
  ips: TopIpRow[];
};

/** The Overview page's layout, shared by the real dashboard and the demo. `aside` is the last side panel. */
export function OverviewView({
  base,
  data: { stats, latest, alertCounts, alerts, buckets, ips },
  aside,
}: {
  base: Base;
  data: OverviewData;
  aside: ReactNode;
}) {
  return (
    <>
      <PageHeader eyebrow="Control room" title="Overview" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Events · 24 h"
          value={formatCount(stats.events24h)}
          note={stats.sourcesOnline === 0 ? "No source has sent anything today" : "From all sources"}
          icon={<Activity className="size-4" />}
        />
        <StatCard
          label="Open alerts"
          value={alertCounts.total}
          note={
            alertCounts.total === 0
              ? "Nothing needs you right now"
              : `${alertCounts.high} high · ${alertCounts.medium} medium · ${alertCounts.low} low`
          }
          tone={alertCounts.high > 0 ? "high" : "default"}
          icon={<Bell className="size-4" />}
        />
        <StatCard
          label="Sources online"
          value={`${stats.sourcesOnline} / ${SOURCES.length}`}
          note="Sent an event in the last 24 h"
          icon={<Server className="size-4" />}
        />
        <StatCard
          label="Failed sign-ins"
          value={stats.failedSignIns24h}
          note="At this console, last 24 h"
          tone={stats.failedSignIns24h > 0 ? "high" : "default"}
          icon={<KeyRound className="size-4" />}
        />
      </div>

      <div className="mt-6 grid items-start gap-6 xl:grid-cols-3">
        <div className="min-w-0 xl:col-span-2">
          <Panel title="Events over time · 24 h">
            <EventsChart buckets={buckets} />
          </Panel>
        </div>
        <Panel title="Busiest IPs · 24 h">
          <TopIps rows={ips} />
        </Panel>
      </div>

      <div className="mt-6 grid gap-6 2xl:grid-cols-3">
        <div className="min-w-0 2xl:col-span-2">
          <Panel
            title="Live events"
            action={
              <Link
                href={`${base}/events` as Route}
                className="inline-flex items-center gap-1 text-sm text-accent hover:underline"
              >
                All events <ArrowRight className="size-4" aria-hidden />
              </Link>
            }
          >
            <LiveEventList
              initial={latest}
              max={8}
              caption="Latest security events"
              empty={
                <EmptyState icon={<Activity className="size-6" />} title="Waiting for the first event">
                  When HomeHaat and Oppora send signed events, they appear here the moment they arrive.
                </EmptyState>
              }
            />
          </Panel>
        </div>

        <div className="grid content-start gap-6 lg:grid-cols-2 2xl:grid-cols-1">
          <Panel
            title="Open alerts"
            action={
              <Link
                href={`${base}/alerts` as Route}
                className="inline-flex items-center gap-1 text-sm text-accent hover:underline"
              >
                All alerts <ArrowRight className="size-4" aria-hidden />
              </Link>
            }
          >
            {alerts.length > 0 ? (
              <AlertList alerts={alerts} label="Latest open alerts" base={base} />
            ) : (
              <p className="text-sm text-muted">No open alerts. GuardRail is watching.</p>
            )}
          </Panel>

          <Panel title="Sources">
            <ul className="divide-y divide-line">
              {SOURCES.map((s) => (
                <li key={s} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="font-medium">{SOURCE_INFO[s].name}</p>
                    <Mono className="block truncate text-muted">{SOURCE_INFO[s].host}</Mono>
                  </div>
                  <SourceStatus {...stats.sources[s]} />
                </li>
              ))}
            </ul>
          </Panel>

          {aside}
        </div>
      </div>
    </>
  );
}
