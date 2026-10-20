import type { ReactNode } from "react";

/** One number. `value` null = no data yet: shows "—" and the note says why (never a made-up number). */
export function StatCard({
  label,
  value,
  note,
  icon,
  tone = "default",
}: {
  label: string;
  value: number | string | null;
  note?: string;
  icon?: ReactNode;
  tone?: "default" | "high";
}) {
  return (
    <div className="rounded-xl border border-line bg-panel p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="eyebrow">{label}</p>
        {icon && (
          <span className="text-muted" aria-hidden>
            {icon}
          </span>
        )}
      </div>
      <p
        className={`mt-3 font-display text-3xl font-semibold tabular-nums ${tone === "high" ? "text-sev-high" : "text-text"}`}
      >
        {value ?? "—"}
      </p>
      {note && <p className="mt-1 text-sm text-muted">{note}</p>}
    </div>
  );
}
