import { CircleCheck, ExternalLink } from "lucide-react";
import { useEffect, useRef } from "react";
import { EventTypeBadge } from "@/components/events/EventBadges";
import { Panel } from "@/components/ui/Panel";
import { SeverityBadge } from "@/components/ui/SeverityBadge";
import type { EventType } from "@/lib/events/types";
import { formatCount, formatTime } from "@/lib/format";
import type { AnalyzeResponse } from "@/lib/validation/logs";

/** The analysis of one uploaded file: what was read, then one card per attack found. */
export function LogResults({ name, result }: { name: string; result: AnalyzeResponse }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), [result]); // move focus to the results so keyboard users land there

  const byType = Object.entries(result.byType) as [EventType, number][];
  return (
    <section aria-labelledby="results-title" className="space-y-6">
      <div>
        <p className="eyebrow">Results</p>
        <h2
          id="results-title"
          ref={heading}
          tabIndex={-1}
          className="font-display text-xl font-semibold break-words"
        >
          {name}
        </h2>
      </div>

      <Panel title="What was read">
        <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          <Stat label="Lines" value={formatCount(result.lines)} />
          <Stat
            label="Recognised"
            value={formatCount(result.formats.access + result.formats.auth)}
            note={[
              result.formats.access && `${formatCount(result.formats.access)} access`,
              result.formats.auth && `${formatCount(result.formats.auth)} auth.log`,
            ]
              .filter(Boolean)
              .join(" · ")}
          />
          <Stat label="Not understood" value={formatCount(result.unreadable)} />
          <Stat label="Security events" value={formatCount(result.events)} />
        </dl>
        {result.firstAt && result.lastAt && (
          <p className="mt-4 text-sm text-muted">
            From <span className="font-mono text-text">{formatTime(result.firstAt)}</span> to{" "}
            <span className="font-mono text-text">{formatTime(result.lastAt)}</span> IST
          </p>
        )}
        {byType.length > 0 && (
          <ul className="mt-4 flex flex-wrap gap-2" aria-label="Security events by type">
            {byType.map(([type, n]) => (
              <li key={type} className="inline-flex items-center gap-1.5 text-sm">
                <EventTypeBadge type={type} /> <span className="font-mono text-muted">{formatCount(n)}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {result.findings.length === 0 ? (
        <p className="flex items-center gap-2 rounded-xl border border-ok/40 bg-ok/10 px-4 py-3 text-sm text-ok">
          <CircleCheck className="size-4 shrink-0" aria-hidden /> No attacks found by the six rules.
        </p>
      ) : (
        <div>
          <h3 className="mb-3 font-display text-sm font-semibold tracking-wide uppercase">
            {result.findings.length} {result.findings.length === 1 ? "attack" : "attacks"} found
          </h3>
          <ul className="grid gap-4 xl:grid-cols-2">
            {result.findings.map((f) => (
              <li key={`${f.ruleId}:${f.subject}`} className="rounded-xl border border-line bg-panel p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <SeverityBadge severity={f.severity} />
                  <a
                    href={f.mitre.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-11 items-center gap-1 font-mono text-xs text-accent hover:underline sm:min-h-0"
                  >
                    {f.mitre.id} {f.mitre.name} <ExternalLink className="size-3" aria-hidden />
                    <span className="sr-only">(opens MITRE ATT&CK in a new tab)</span>
                  </a>
                </div>
                <p className="mt-2 font-medium break-words">{f.title}</p>
                <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                  <dt className="text-muted">Events</dt>
                  <dd className="font-mono">{formatCount(f.events)}</dd>
                  <dt className="text-muted">First seen</dt>
                  <dd className="font-mono">{formatTime(f.firstSeen)}</dd>
                  <dt className="text-muted">Last seen</dt>
                  <dd className="font-mono">{formatTime(f.lastSeen)}</dd>
                  <dt className="text-muted">Lines</dt>
                  <dd className="font-mono break-words">
                    {f.lines.join(", ")}
                    {f.events > f.lines.length && " …"}
                  </dd>
                </dl>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div>
      <dt className="eyebrow">{label}</dt>
      <dd className="mt-1 font-display text-2xl">{value}</dd>
      {note && <dd className="text-xs text-muted">{note}</dd>}
    </div>
  );
}
