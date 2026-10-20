import { Activity, Bell, KeyRound, Server, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/AppShell";
import { EmptyState } from "@/components/ui/EmptyState";
import { Mono } from "@/components/ui/Mono";
import { Panel } from "@/components/ui/Panel";
import { StatCard } from "@/components/ui/StatCard";
import { requireActiveSession } from "@/lib/auth/guards";
import { securityOverview } from "@/lib/dashboard/overview";

export const metadata: Metadata = { title: "Overview" };

const SOURCES = [
  { name: "HomeHaat", host: "homehaat.vercel.app", stage: 3 },
  { name: "Oppora", host: "oppora-app.vercel.app", stage: 5 },
];

export default async function OverviewPage() {
  const { user, session } = await requireActiveSession();
  const stats = await securityOverview(user.id);

  return (
    <>
      <PageHeader eyebrow="Control room" title="Overview" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Events · 24 h"
          value={null}
          note="No sources connected yet"
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
          value={`0 / ${SOURCES.length}`}
          note="HomeHaat and Oppora"
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
        <div className="xl:col-span-2">
          <Panel title="Live events">
            <EmptyState icon={<Activity className="size-6" />} title="Waiting for the first event">
              When HomeHaat and Oppora start sending signed events, they appear here the moment they arrive.
            </EmptyState>
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="Sources">
            <ul className="divide-y divide-line">
              {SOURCES.map((s) => (
                <li
                  key={s.name}
                  className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="font-medium">{s.name}</p>
                    <Mono className="block truncate text-muted">{s.host}</Mono>
                  </div>
                  <span className="shrink-0 rounded-full border border-line px-2 py-0.5 font-mono text-xs text-muted">
                    Not connected
                  </span>
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
