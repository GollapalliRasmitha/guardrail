import { Activity, ArrowRight, Bell, KeyRound, Server, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { LiveEventList } from "@/components/events/LiveEventList";
import { SourceStatus } from "@/components/events/SourceStatus";
import { PageHeader } from "@/components/shell/AppShell";
import { EmptyState } from "@/components/ui/EmptyState";
import { Mono } from "@/components/ui/Mono";
import { Panel } from "@/components/ui/Panel";
import { StatCard } from "@/components/ui/StatCard";
import { requireActiveSession } from "@/lib/auth/guards";
import { overviewStats } from "@/lib/dashboard/overview";
import { latestEvents } from "@/lib/events/query";
import { SOURCE_INFO, SOURCES } from "@/lib/events/types";
import { formatCount } from "@/lib/format";

export const metadata: Metadata = { title: "Overview" };

export default async function OverviewPage() {
  const { user, session } = await requireActiveSession();
  const [stats, latest] = await Promise.all([overviewStats(user.id), latestEvents(8)]);

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
          value={null}
          note="Detection rules arrive in Stage 4"
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

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <div className="min-w-0 xl:col-span-2">
          <Panel
            title="Live events"
            action={
              <Link
                href="/dashboard/events"
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

        <div className="space-y-6">
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

          <Panel title="Your account">
            <dl className="space-y-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted">Two-factor</dt>
                <dd className="inline-flex items-center gap-1.5 text-ok">
                  <ShieldCheck className="size-4" aria-hidden /> On
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted">Signed-in devices</dt>
                <dd className="tabular-nums">{stats.activeSessions}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted">This session ends</dt>
                <dd>
                  <Mono>
                    {session.expiresAt.toLocaleString("en-IN", {
                      timeZone: "Asia/Kolkata",
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </Mono>
                </dd>
              </div>
            </dl>
          </Panel>
        </div>
      </div>
    </>
  );
}
