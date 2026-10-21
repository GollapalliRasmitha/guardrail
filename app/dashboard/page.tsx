import { ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { RefreshOnEvents } from "@/components/live/RefreshOnEvents";
import { Mono } from "@/components/ui/Mono";
import { Panel } from "@/components/ui/Panel";
import { OverviewView } from "@/components/views/OverviewView";
import { activeAlertCounts, latestActiveAlerts } from "@/lib/alerts/query";
import { requireActiveSession } from "@/lib/auth/guards";
import { eventsPerHour, topIps } from "@/lib/dashboard/charts";
import { overviewStats } from "@/lib/dashboard/overview";
import { latestEvents } from "@/lib/events/query";

export const metadata: Metadata = { title: "Overview" };

export default async function OverviewPage() {
  const { user, session } = await requireActiveSession();
  const [stats, latest, alertCounts, alerts, hours, ips] = await Promise.all([
    overviewStats(user.id),
    latestEvents(8),
    activeAlertCounts(),
    latestActiveAlerts(5),
    eventsPerHour(),
    topIps(5),
  ]);
  // Dates become strings before going to the (client) chart component.
  const buckets = hours.map((b) => ({ ...b, start: b.start.toISOString() }));

  return (
    <>
      <RefreshOnEvents />
      <OverviewView
        base="/dashboard"
        data={{ stats, latest, alertCounts, alerts, buckets, ips }}
        aside={
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
        }
      />
    </>
  );
}
