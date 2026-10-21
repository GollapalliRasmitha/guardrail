// [KEY LOGIC] The six detection rules, each mapped to a MITRE ATT&CK technique.
//
// A rule is a PURE function: given the newest event (the "trigger") and the earlier events with the same key
// (same account, same IP, or same site), it says "attack" or "nothing". No database, no clock, so every rule is
// tested with small fixed lists of events. lib/detection/engine.ts fetches the events and stores the alerts.

import type { RuleId, Severity } from "@/lib/alerts/types";
import { SOURCE_INFO, type EventType, type SourceId } from "@/lib/events/types";

/** The fields a rule may look at. */
export type RuleEvent = {
  id: number;
  type: EventType;
  source: SourceId;
  occurredAt: Date;
  ip: string | null;
  ipHash: string | null;
  actor: string | null; // masked, for titles
  actorId: string | null; // keyed hash from the sender, tells accounts apart
  country: string | null;
};

export type Finding = { severity: Severity; title: string; subject: string; eventIds: number[] };

/** What the events are grouped by. The engine turns this into a database filter. */
export type KeyKind = "actor" | "ip" | "source";

export type Rule = {
  id: RuleId;
  name: string;
  mitre: { id: string; name: string; url: string };
  description: string;
  advice: string[]; // "what to do", shown on the alert page
  watches: readonly EventType[];
  windowMs: number;
  keyBy: KeyKind;
  keyOf: (e: RuleEvent) => string | null;
  evaluate: (trigger: RuleEvent, history: RuleEvent[]) => Finding | null;
};

const MIN = 60_000;
const DAY = 24 * 60 * MIN;

// ---- small helpers ----------------------------------------------------------------------------------------------

const keyOf: Record<KeyKind, (e: RuleEvent) => string | null> = {
  // The sender's account hash if there is one; the masked email as a fallback (less precise, still useful).
  actor: (e) => (e.actorId ? `actor:${e.actorId}` : e.actor ? `actor~${e.actor}` : null),
  ip: (e) => (e.ipHash ? `ip:${e.ipHash}` : null),
  source: (e) => `source:${e.source}`,
};

/** The events inside the window that ends at the trigger (the engine already filters; this keeps rules honest). */
function inWindow(trigger: RuleEvent, history: RuleEvent[], windowMs: number) {
  const end = trigger.occurredAt.getTime();
  return history.filter((e) => e.occurredAt.getTime() <= end && end - e.occurredAt.getTime() <= windowMs);
}

const ids = (events: RuleEvent[]) => events.map((e) => e.id);
const accountOf = (e: RuleEvent) => e.actor ?? "an unknown account";
const ipOf = (e: RuleEvent) => e.ip ?? "an unknown IP";

function technique(id: string, name: string) {
  return { id, name, url: `https://attack.mitre.org/techniques/${id.replace(".", "/")}/` };
}

// ---- the rules ---------------------------------------------------------------------------------------------------

const bruteForce: Rule = {
  id: "brute_force",
  name: "Brute force",
  mitre: technique("T1110", "Brute Force"),
  description: "Many wrong passwords for one account: someone is guessing its password.",
  advice: [
    "Check whether any sign-in for this account succeeded afterwards (Events, search the account).",
    "If one did, reset the account's password and sign it out everywhere.",
    "Consider a tighter per-account sign-in limit.",
  ],
  watches: ["login_failed"],
  windowMs: 10 * MIN,
  keyBy: "actor",
  keyOf: keyOf.actor,
  evaluate(trigger, history) {
    const fails = inWindow(trigger, history, this.windowMs);
    if (fails.length < 10) return null;
    return {
      severity: "high",
      title: `Brute force on ${accountOf(trigger)}`,
      subject: accountOf(trigger),
      eventIds: ids(fails),
    };
  },
};

const credentialStuffing: Rule = {
  id: "credential_stuffing",
  name: "Credential stuffing",
  mitre: technique("T1110.004", "Credential Stuffing"),
  description: "One IP trying many different accounts: someone is testing a leaked email/password list.",
  advice: [
    "Look for any successful sign-in from this IP (Events, search the IP).",
    "Those accounts may use a leaked password elsewhere: ask them to change it.",
    "Block or rate-limit this IP more strictly if it keeps going.",
  ],
  watches: ["login_failed"],
  windowMs: 10 * MIN,
  keyBy: "ip",
  keyOf: keyOf.ip,
  evaluate(trigger, history) {
    const fails = inWindow(trigger, history, this.windowMs);
    const accounts = new Set(fails.map((e) => keyOf.actor(e)).filter(Boolean));
    if (accounts.size < 5) return null;
    return {
      severity: "high",
      title: `Credential stuffing from ${ipOf(trigger)}`,
      subject: ipOf(trigger),
      eventIds: ids(fails),
    };
  },
};

const forgedWebhook: Rule = {
  id: "forged_webhook",
  name: "Forged payment webhook",
  mitre: technique("T1565", "Data Manipulation"),
  description: "A payment notification with a wrong signature: someone tried to fake a payment.",
  advice: [
    "No order was changed: the signature check refused it.",
    "If it repeats, check that the webhook secret hasn't leaked; rotate it in Razorpay and the site's settings.",
  ],
  watches: ["webhook_signature_failed"],
  windowMs: 60 * MIN,
  keyBy: "source",
  keyOf: keyOf.source,
  evaluate(trigger, history) {
    return {
      severity: "high",
      title: `Forged payment webhook at ${SOURCE_INFO[trigger.source].name}`,
      subject: SOURCE_INFO[trigger.source].name,
      eventIds: ids(inWindow(trigger, history, this.windowMs)),
    };
  },
};

const scanning: Rule = {
  id: "scanning",
  name: "Scanning",
  mitre: technique("T1595", "Active Scanning"),
  description: "Requests for files the site doesn't have (/.env, /wp-admin…): a bot looking for weaknesses.",
  advice: [
    "Usually harmless noise, but check none of the paths returned 200.",
    "Make sure files like .env or .git are never served by the site.",
  ],
  watches: ["suspicious_path"],
  windowMs: 5 * MIN,
  keyBy: "ip",
  keyOf: keyOf.ip,
  evaluate(trigger, history) {
    const hits = inWindow(trigger, history, this.windowMs);
    if (hits.length === 0) return null;
    return {
      severity: hits.length >= 5 ? "medium" : "low",
      title: `Scanning from ${ipOf(trigger)}`,
      subject: ipOf(trigger),
      eventIds: ids(hits),
    };
  },
};

const flood: Rule = {
  id: "flood",
  name: "Request flood",
  mitre: technique("T1499", "Endpoint Denial of Service"),
  description: "One IP hit the rate limit 50 times in a minute: an attempt to overload the site.",
  advice: [
    "The rate limit is doing its job; check the site stayed responsive.",
    "If it continues, block the IP at the hosting provider.",
  ],
  watches: ["rate_limited"],
  windowMs: 1 * MIN,
  keyBy: "ip",
  keyOf: keyOf.ip,
  evaluate(trigger, history) {
    const hits = inWindow(trigger, history, this.windowMs);
    if (hits.length < 50) return null;
    return {
      severity: "medium",
      title: `Request flood from ${ipOf(trigger)}`,
      subject: ipOf(trigger),
      eventIds: ids(hits),
    };
  },
};

const newIpLogin: Rule = {
  id: "new_ip_login",
  name: "Sign-in from a new IP",
  mitre: technique("T1078", "Valid Accounts"),
  description:
    "A successful sign-in from an IP this account hasn't used in 30 days: maybe a stolen password.",
  advice: [
    "Often it's just a new phone or Wi-Fi. If unsure, ask the account owner.",
    "For an admin account, confirm it was you; if not, change the password and sign out everywhere.",
  ],
  watches: ["login_success", "admin_login"],
  windowMs: 30 * DAY,
  keyBy: "actor",
  keyOf: keyOf.actor,
  evaluate(trigger, history) {
    if (!trigger.ipHash) return null;
    const earlier = inWindow(trigger, history, this.windowMs).filter((e) => e.id !== trigger.id);
    if (earlier.length === 0) return null; // a brand-new account has no "usual" IP yet
    if (earlier.some((e) => e.ipHash === trigger.ipHash)) return null;
    return {
      severity: trigger.type === "admin_login" ? "high" : "medium",
      title: `Sign-in from a new IP for ${accountOf(trigger)}`,
      subject: accountOf(trigger),
      eventIds: [trigger.id],
    };
  },
};

export const RULES: readonly Rule[] = [
  bruteForce,
  credentialStuffing,
  forgedWebhook,
  scanning,
  flood,
  newIpLogin,
];

export function ruleFor(id: RuleId): Rule {
  return RULES.find((r) => r.id === id)!;
}
