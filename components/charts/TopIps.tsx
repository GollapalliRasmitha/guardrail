import { formatCount } from "@/lib/format";

export type TopIpRow = { ipHash: string | null; ip: string | null; country: string | null; n: number };

/**
 * The busiest IPs of the last 24 hours as a ranked list with thin bars (one hue: it shows "how much", not "which").
 * The number is always written next to the bar, so it never depends on the bar alone.
 */
export function TopIps({ rows }: { rows: TopIpRow[] }) {
  if (rows.length === 0) return <p className="text-sm text-muted">No IPs in the last 24 hours.</p>;
  const max = Math.max(...rows.map((r) => r.n));
  return (
    <ol className="space-y-3" aria-label="Busiest IPs, last 24 hours">
      {rows.map((r, i) => (
        <li key={r.ipHash ?? i}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate font-mono">
              {r.ip ?? <span className="text-muted">IP wiped (older than 30 days)</span>}
              {r.country && <span className="text-muted"> {r.country}</span>}
            </span>
            <span className="shrink-0 font-mono text-muted">{formatCount(r.n)}</span>
          </div>
          <div className="mt-1 h-1.5 rounded-full bg-panel-2" aria-hidden>
            <div
              className="h-full rounded-full bg-accent"
              style={{ width: `${Math.max(4, (r.n / max) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ol>
  );
}
