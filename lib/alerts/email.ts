// [KEY LOGIC] Alert emails: when to send one, and what it may say. Pure functions (no network), so both are tested.
// Sending itself is in lib/alerts/notify.ts (Resend's free API).

import { ruleFor } from "@/lib/detection/rules";
import { SOURCE_INFO, type SourceId } from "@/lib/events/types";
import type { RuleId, Severity } from "./types";

/** At most this many alert emails a day: protects the inbox and Resend's free 100/day. */
export const DAILY_EMAIL_CAP = 20;

export type EmailDecision =
  { send: true } | { send: false; reason: "not_high" | "already_emailed" | "daily_cap" | "not_configured" };

export function emailDecision(input: {
  severity: Severity;
  emailedAt: Date | null;
  sentLast24h: number;
  configured: boolean;
}): EmailDecision {
  if (input.severity !== "high") return { send: false, reason: "not_high" };
  if (input.emailedAt) return { send: false, reason: "already_emailed" }; // one email per alert, ever
  if (!input.configured) return { send: false, reason: "not_configured" };
  if (input.sentLast24h >= DAILY_EMAIL_CAP) return { send: false, reason: "daily_cap" };
  return { send: true };
}

const escape = (text: string) =>
  text.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );

/**
 * Privacy: the email names the rule, the site and how many events, and links to the dashboard (sign-in + 2FA
 * needed). It never contains an IP address or the alert's subject, because email isn't a private place.
 */
export function buildAlertEmail(
  alert: {
    id: number;
    ruleId: RuleId;
    source: SourceId;
    severity: Severity;
    eventCount: number;
    firstSeen: Date;
  },
  appUrl: string,
) {
  const rule = ruleFor(alert.ruleId);
  const site = SOURCE_INFO[alert.source].name;
  const link = `${appUrl.replace(/\/$/, "")}/dashboard/alerts/${alert.id}`;
  const severity = alert.severity[0]!.toUpperCase() + alert.severity.slice(1);
  const subject = `[GuardRail] ${severity}: ${rule.name} (${rule.mitre.id}) at ${site}`;
  const lines = [
    `${rule.name} detected at ${site}.`,
    `${rule.description}`,
    ``,
    `Severity: ${severity}`,
    `MITRE ATT&CK: ${rule.mitre.id} ${rule.mitre.name}`,
    `So far: ${alert.eventCount} events`,
    ``,
    `Open the incident: ${link}`,
  ];
  const html = `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.5;color:#0d1628">
<p style="margin:0 0 4px;color:#b42318;font-weight:600">${escape(severity)} alert</p>
<h1 style="font-size:20px;margin:0 0 12px">${escape(rule.name)} at ${escape(site)}</h1>
<p style="margin:0 0 12px">${escape(rule.description)}</p>
<p style="margin:0 0 16px">MITRE ATT&amp;CK ${escape(rule.mitre.id)} · ${alert.eventCount} events so far</p>
<p><a href="${escape(link)}" style="background:#6fd3c5;color:#052520;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:600">Open the incident</a></p>
</div>`;
  return { subject, text: lines.join("\n"), html };
}
