import { ArrowLeft, ExternalLink } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { StatusBadge } from "@/components/alerts/StatusBadge";
import { Timeline } from "@/components/alerts/Timeline";
import { SourceBadge } from "@/components/events/EventBadges";
import { EventList } from "@/components/events/EventList";
import type { Base } from "@/components/shell/nav";
import { Mono } from "@/components/ui/Mono";
import { Panel } from "@/components/ui/Panel";
import { SeverityBadge } from "@/components/ui/SeverityBadge";
import type { AlertActivityRow, AlertRow } from "@/lib/db/schema";
import { ruleFor } from "@/lib/detection/rules";
import type { EventView } from "@/lib/events/filters";
import { formatTime } from "@/lib/format";

/**
 * One incident: what happened, what to do, evidence, details, timeline. Shared by the dashboard and the demo;
 * `actions` and `noteForm` are the parts that change things (the demo passes read-only text instead).
 */
export function IncidentView({
  base,
  alert,
  activity,
  events,
  actions,
  noteForm,
}: {
  base: Base;
  alert: AlertRow;
  activity: AlertActivityRow[];
  events: EventView[];
  actions: ReactNode;
  noteForm: ReactNode;
}) {
  const rule = ruleFor(alert.ruleId);
  return (
    <>
      <Link
        href={`${base}/alerts` as Route}
        className="mb-4 inline-flex min-h-11 items-center gap-1 text-sm text-muted hover:text-text"
      >
        <ArrowLeft className="size-4" aria-hidden /> All alerts
      </Link>

      <header className="mb-6">
        <div className="flex flex-wrap items-center gap-2">
          <SeverityBadge severity={alert.severity} />
          <StatusBadge status={alert.status} />
          <SourceBadge source={alert.source} />
          <Mono className="text-muted">#{alert.id}</Mono>
        </div>
        <h1 className="mt-3 font-display text-2xl font-semibold [overflow-wrap:anywhere] sm:text-3xl">
          {alert.title}
        </h1>
        <p className="mt-2 max-w-3xl text-muted">{rule.description}</p>
      </header>

      <div className="grid gap-6 2xl:grid-cols-3">
        <div className="min-w-0 space-y-6 2xl:col-span-2">
          <Panel title="What to do">
            <ol className="list-decimal space-y-1.5 pl-5 text-sm">
              {rule.advice.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
            <div className="mt-5 border-t border-line pt-5">{actions}</div>
          </Panel>

          <Panel title={`Evidence · ${alert.eventCount} event${alert.eventCount === 1 ? "" : "s"}`}>
            <EventList events={events} caption="Events that triggered this alert, newest first" />
            {alert.eventCount > events.length && (
              <p className="mt-3 text-xs text-muted">Showing the newest {events.length}.</p>
            )}
          </Panel>
        </div>

        <div className="grid content-start gap-6 lg:grid-cols-2 2xl:grid-cols-1">
          <Panel title="Details">
            <dl className="space-y-3 text-sm">
              <div className="flex flex-wrap justify-between gap-2">
                <dt className="text-muted">MITRE ATT&amp;CK</dt>
                <dd>
                  <a
                    href={rule.mitre.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-accent hover:underline"
                  >
                    <Mono>{rule.mitre.id}</Mono> {rule.mitre.name}
                    <ExternalLink className="size-3.5" aria-hidden />
                    <span className="sr-only">(opens in a new tab)</span>
                  </a>
                </dd>
              </div>
              <div className="flex flex-wrap justify-between gap-2">
                <dt className="text-muted">About</dt>
                <dd className="[overflow-wrap:anywhere]">
                  <Mono>{alert.subject}</Mono>
                </dd>
              </div>
              <div className="flex flex-wrap justify-between gap-2">
                <dt className="text-muted">First seen</dt>
                <dd>
                  <Mono>{formatTime(alert.firstSeen)} IST</Mono>
                </dd>
              </div>
              <div className="flex flex-wrap justify-between gap-2">
                <dt className="text-muted">Last seen</dt>
                <dd>
                  <Mono>{formatTime(alert.lastSeen)} IST</Mono>
                </dd>
              </div>
            </dl>
          </Panel>

          <Panel title="Timeline">
            <Timeline activity={activity} />
            <div className="mt-6 border-t border-line pt-5">{noteForm}</div>
          </Panel>
        </div>
      </div>
    </>
  );
}
