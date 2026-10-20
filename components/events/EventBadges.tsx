import { EVENT_INFO, SOURCE_INFO, type EventType, type SourceId } from "@/lib/events/types";

const toneDot = { bad: "bg-sev-high", warn: "bg-sev-medium", info: "bg-sev-low" } as const;

/** Event type: a coloured dot plus the words (the dot is a hint, never the only signal). */
export function EventTypeBadge({ type }: { type: EventType }) {
  const { label, tone } = EVENT_INFO[type];
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap">
      <span className={`size-2 shrink-0 rounded-full ${toneDot[tone]}`} aria-hidden />
      {label}
    </span>
  );
}

export function SourceBadge({ source }: { source: SourceId }) {
  return (
    <span className="rounded-md border border-line bg-panel-2 px-1.5 py-0.5 font-mono text-xs text-muted">
      {SOURCE_INFO[source].name}
    </span>
  );
}
