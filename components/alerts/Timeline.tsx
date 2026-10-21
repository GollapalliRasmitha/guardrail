import { Bell, CheckCircle2, Mail, MailWarning, MessageSquare, Plus, TrendingUp } from "lucide-react";
import type { AlertActivityRow } from "@/lib/db/schema";
import { formatTime } from "@/lib/format";

const STATUS_WORDS: Record<string, string> = {
  open: "open",
  acknowledged: "acknowledged",
  resolved: "resolved",
};
const SKIP_WORDS: Record<string, string> = {
  not_configured: "email isn't set up yet (RESEND_API_KEY and ALERT_EMAIL_TO)",
  daily_cap: "the daily email limit was reached",
};

/** What each timeline entry says, in plain words. */
function describe(a: AlertActivityRow): { icon: React.ReactNode; text: string } {
  const d = a.detail;
  switch (a.kind) {
    case "created":
      return {
        icon: <Bell className="size-4" />,
        text: `Alert raised (${d.severity}) with ${d.events} event${d.events === 1 ? "" : "s"}`,
      };
    case "events":
      return {
        icon: <Plus className="size-4" />,
        text: `${d.added} more event${d.added === 1 ? "" : "s"}${d.until ? `, up to ${formatTime(String(d.until)).split(", ")[1]}` : ""}`,
      };
    case "severity":
      return { icon: <TrendingUp className="size-4" />, text: `Severity raised from ${d.from} to ${d.to}` };
    case "status":
      return {
        icon: <CheckCircle2 className="size-4" />,
        text: `Marked ${STATUS_WORDS[String(d.to)] ?? d.to} (was ${STATUS_WORDS[String(d.from)] ?? d.from})`,
      };
    case "note":
      return { icon: <MessageSquare className="size-4" />, text: a.note ?? "" };
    case "email_sent":
      return { icon: <Mail className="size-4" />, text: "Email sent to you" };
    case "email_skipped":
      return {
        icon: <MailWarning className="size-4" />,
        text: `No email: ${SKIP_WORDS[String(d.reason)] ?? d.reason}`,
      };
    case "email_failed":
      return {
        icon: <MailWarning className="size-4" />,
        text: `Email failed${d.status ? ` (HTTP ${d.status})` : ""}; it will be tried again`,
      };
  }
}

/** The incident timeline, oldest first, as an ordered list (screen readers announce the count and order). */
export function Timeline({ activity }: { activity: AlertActivityRow[] }) {
  return (
    <ol className="relative space-y-4 border-l border-line pl-6">
      {activity.map((a) => {
        const { icon, text } = describe(a);
        return (
          <li key={a.id} className="relative">
            <span
              className={`absolute top-0.5 -left-[2.05rem] grid size-6 place-items-center rounded-full border border-line bg-panel ${
                a.kind === "note" ? "text-accent" : "text-muted"
              }`}
              aria-hidden
            >
              {icon}
            </span>
            <p className="font-mono text-xs text-muted">
              <time dateTime={a.createdAt.toISOString()}>{formatTime(a.createdAt)}</time> IST
            </p>
            <p
              className={`mt-0.5 text-sm [overflow-wrap:anywhere] ${a.kind === "note" ? "whitespace-pre-wrap" : ""}`}
            >
              {text}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
