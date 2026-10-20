import type { Metadata } from "next";
import { SourceStatus } from "@/components/events/SourceStatus";
import { PageHeader } from "@/components/shell/AppShell";
import { Mono } from "@/components/ui/Mono";
import { Panel } from "@/components/ui/Panel";
import { requireActiveSession } from "@/lib/auth/guards";
import { sourceStats } from "@/lib/events/query";
import { secretFor } from "@/lib/ingest/store";
import { SOURCE_INFO, SOURCES } from "@/lib/events/types";
import { formatCount, formatTime } from "@/lib/format";

export const metadata: Metadata = { title: "Sources" };

export default async function SourcesPage() {
  await requireActiveSession();
  const stats = await sourceStats();

  return (
    <>
      <PageHeader eyebrow="Connected sites" title="Sources" />
      <div className="grid gap-6 lg:grid-cols-2">
        {SOURCES.map((s) => {
          const info = SOURCE_INFO[s];
          const configured = secretFor(s) !== ""; // only whether it's set, never the value
          return (
            <Panel key={s} title={info.name} action={<SourceStatus {...stats[s]} />}>
              <dl className="space-y-3 text-sm">
                <div className="flex flex-wrap justify-between gap-2">
                  <dt className="text-muted">Site</dt>
                  <dd>
                    <Mono>{info.host}</Mono>
                  </dd>
                </div>
                <div className="flex flex-wrap justify-between gap-2">
                  <dt className="text-muted">Signing secret</dt>
                  <dd className={configured ? "text-ok" : "text-sev-medium"}>
                    {configured ? "Set" : "Not set: requests are refused"}
                  </dd>
                </div>
                <div className="flex flex-wrap justify-between gap-2">
                  <dt className="text-muted">Last event</dt>
                  <dd>
                    <Mono>{stats[s].lastSeen ? `${formatTime(stats[s].lastSeen)} IST` : "Never"}</Mono>
                  </dd>
                </div>
                <div className="flex flex-wrap justify-between gap-2">
                  <dt className="text-muted">Events · 24 h</dt>
                  <dd className="tabular-nums">{formatCount(stats[s].last24h)}</dd>
                </div>
              </dl>
              <p className="mt-4 border-t border-line pt-4 text-xs text-muted">
                Sends to <Mono className="text-text">POST /api/ingest</Mono> with header{" "}
                <Mono className="text-text">X-GuardRail-Source: {s}</Mono>, signed with{" "}
                <Mono className="text-text">{info.secretEnv}</Mono>.
              </p>
            </Panel>
          );
        })}
      </div>
    </>
  );
}
