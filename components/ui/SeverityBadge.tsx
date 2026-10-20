import { CircleAlert, Info, TriangleAlert } from "lucide-react";

export type Severity = "high" | "medium" | "low";

const look = {
  high: { label: "High", Icon: CircleAlert, cls: "text-sev-high border-sev-high/40 bg-sev-high/10" },
  medium: {
    label: "Medium",
    Icon: TriangleAlert,
    cls: "text-sev-medium border-sev-medium/40 bg-sev-medium/10",
  },
  low: { label: "Low", Icon: Info, cls: "text-sev-low border-sev-low/40 bg-sev-low/10" },
} as const;

/** Severity is never colour alone: always a word and an icon too (colour-blind safe). */
export function SeverityBadge({ severity }: { severity: Severity }) {
  const { label, Icon, cls } = look[severity];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-xs ${cls}`}
    >
      <Icon className="size-3.5" aria-hidden />
      {label}
    </span>
  );
}
