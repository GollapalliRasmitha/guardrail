import { formatTime } from "@/lib/format";

/** "Online" (green) if the source sent something in the last 24 hours, otherwise a plain grey label. */
export function SourceStatus({ lastSeen, online }: { lastSeen: Date | null; online: boolean }) {
  if (!lastSeen) {
    return (
      <span className="shrink-0 rounded-full border border-line px-2 py-0.5 font-mono text-xs text-muted">
        Not connected
      </span>
    );
  }
  return (
    <span
      className={`shrink-0 rounded-full border px-2 py-0.5 font-mono text-xs ${online ? "border-ok/40 text-ok" : "border-line text-muted"}`}
      title={`Last event ${formatTime(lastSeen)} IST`}
    >
      {online ? "Online" : "Quiet"}
    </span>
  );
}
