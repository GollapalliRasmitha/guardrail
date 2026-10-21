export type LiveState = "live" | "connecting" | "polling" | "paused" | "offline" | "idle";

const look: Record<LiveState, { label: string; dot: string }> = {
  live: { label: "Live", dot: "bg-accent animate-pulse" },
  connecting: { label: "Connecting…", dot: "bg-sev-medium" },
  polling: { label: "Live (polling)", dot: "bg-accent" },
  paused: { label: "Paused", dot: "bg-muted" },
  offline: { label: "Offline", dot: "bg-sev-high" },
  idle: { label: "No sources yet", dot: "bg-muted" },
};

/** Says honestly whether the live feed is connected. */
export function LiveDot({ state }: { state: LiveState }) {
  const { label, dot } = look[state];
  return (
    <span className="inline-flex items-center gap-2 font-mono text-xs text-muted" role="status">
      <span className={`size-2 rounded-full ${dot}`} aria-hidden />
      {label}
    </span>
  );
}
