import { CheckCircle2, CircleDot, Eye } from "lucide-react";
import type { AlertStatus } from "@/lib/alerts/types";

const look = {
  open: { label: "Open", Icon: CircleDot, cls: "border-sev-high/40 text-text" },
  acknowledged: { label: "Acknowledged", Icon: Eye, cls: "border-sev-medium/40 text-text" },
  resolved: { label: "Resolved", Icon: CheckCircle2, cls: "border-ok/40 text-ok" },
} as const;

/** Word + icon, like SeverityBadge, so status never depends on colour alone. */
export function StatusBadge({ status }: { status: AlertStatus }) {
  const { label, Icon, cls } = look[status];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-xs ${cls}`}
    >
      <Icon className="size-3.5" aria-hidden />
      {label}
    </span>
  );
}
