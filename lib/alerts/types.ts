// The alert vocabulary, shared by the database schema, the detection rules and the pages.

export const SEVERITIES = ["low", "medium", "high"] as const;
export type Severity = (typeof SEVERITIES)[number];

/** For comparing: high > medium > low. */
export const SEVERITY_RANK: Record<Severity, number> = { low: 1, medium: 2, high: 3 };

export const ALERT_STATUSES = ["open", "acknowledged", "resolved"] as const;
export type AlertStatus = (typeof ALERT_STATUSES)[number];

export const RULE_IDS = [
  "brute_force",
  "credential_stuffing",
  "forged_webhook",
  "scanning",
  "flood",
  "new_ip_login",
] as const;
export type RuleId = (typeof RULE_IDS)[number];

export const ACTIVITY_KINDS = [
  "created", // the alert was raised
  "events", // more matching events were added
  "severity", // severity went up
  "status", // open / acknowledged / resolved
  "note", // a note I wrote
  "email_sent",
  "email_skipped", // not configured, or the daily cap was reached
  "email_failed",
] as const;
export type ActivityKind = (typeof ACTIVITY_KINDS)[number];
