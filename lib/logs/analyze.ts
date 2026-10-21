// [KEY LOGIC] Running an uploaded log through the SAME detection rules as live events, entirely in memory.
// Nothing from the file is stored: the result goes back to the browser and is gone.

import { SEVERITY_RANK, type RuleId, type Severity } from "@/lib/alerts/types";
import { RULES, type Rule, type RuleEvent } from "@/lib/detection/rules";
import type { EventType, SourceId } from "@/lib/events/types";
import { parseLine, type LogEvent } from "./parse";

const HISTORY_LIMIT = 500; // like the live engine: the newest 500 events per rule + key are plenty
const LINES_SHOWN = 20;

export type LogFinding = {
  ruleId: RuleId;
  name: string;
  mitre: Rule["mitre"];
  severity: Severity;
  title: string;
  subject: string;
  events: number;
  lines: number[]; // the first few line numbers, so you can find them in the file
  firstSeen: Date;
  lastSeen: Date;
};

export type LogAnalysis = {
  lines: number; // non-blank lines
  formats: { access: number; auth: number };
  unreadable: number;
  events: number;
  byType: Partial<Record<EventType, number>>;
  firstAt: Date | null;
  lastAt: Date | null;
  findings: LogFinding[];
};

type Group = { rule: Rule; finding: LogFinding; lineSet: Set<number> };

/**
 * 1. Sort events by time (log files are mostly in order, but rotated or merged files may not be).
 * 2. For each event and each rule that watches its type: add it to that rule + key's window (account / IP / site),
 *    drop events that left the window, and evaluate the rule exactly as the live engine would.
 * 3. Findings with the same rule + key are merged into ONE finding per attack (like one alert per attack):
 *    events are counted once, severity only goes up, first / last seen grow.
 * The raw IP stands in for the keyed IP hash: it never leaves this function's memory.
 */
export function analyzeEvents(events: LogEvent[], source: SourceId): LogFinding[] {
  const sorted = [...events].sort(
    (a, b) => a.occurredAt.getTime() - b.occurredAt.getTime() || a.line - b.line,
  );
  const windows = new Map<string, RuleEvent[]>();
  const groups = new Map<string, Group>();

  for (const logEvent of sorted) {
    const event: RuleEvent = {
      id: logEvent.line,
      type: logEvent.type,
      source,
      occurredAt: logEvent.occurredAt,
      ip: logEvent.ip,
      ipHash: logEvent.ip,
      actor: logEvent.actor,
      actorId: null,
      country: null,
    };
    for (const rule of RULES) {
      if (!rule.watches.includes(event.type)) continue;
      const key = rule.keyOf(event);
      if (!key) continue;
      const groupKey = `${rule.id}:${key}`;

      const window = windows.get(groupKey) ?? [];
      window.push(event);
      const start = event.occurredAt.getTime() - rule.windowMs;
      while (window.length > HISTORY_LIMIT || window[0]!.occurredAt.getTime() < start) window.shift();
      windows.set(groupKey, window);

      const found = rule.evaluate(event, window);
      if (!found) continue;
      const times = window.filter((w) => found.eventIds.includes(w.id)).map((w) => w.occurredAt.getTime());
      const group = groups.get(groupKey);
      if (!group) {
        groups.set(groupKey, {
          rule,
          lineSet: new Set(found.eventIds),
          finding: {
            ruleId: rule.id,
            name: rule.name,
            mitre: rule.mitre,
            severity: found.severity,
            title: found.title,
            subject: found.subject,
            events: 0,
            lines: [],
            firstSeen: new Date(Math.min(...times)),
            lastSeen: new Date(Math.max(...times)),
          },
        });
        continue;
      }
      for (const id of found.eventIds) group.lineSet.add(id);
      const f = group.finding;
      if (SEVERITY_RANK[found.severity] > SEVERITY_RANK[f.severity]) f.severity = found.severity;
      f.firstSeen = new Date(Math.min(f.firstSeen.getTime(), ...times));
      f.lastSeen = new Date(Math.max(f.lastSeen.getTime(), ...times));
    }
  }

  return [...groups.values()]
    .map(({ finding, lineSet }) => ({
      ...finding,
      events: lineSet.size,
      lines: [...lineSet].sort((a, b) => a - b).slice(0, LINES_SHOWN),
    }))
    .sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] || b.events - a.events);
}

/** Read a whole log file's text and analyse it. `source` = which site the log came from. */
export function analyzeLog(text: string, source: SourceId, now = new Date()): LogAnalysis {
  const result: LogAnalysis = {
    lines: 0,
    formats: { access: 0, auth: 0 },
    unreadable: 0,
    events: 0,
    byType: {},
    firstAt: null,
    lastAt: null,
    findings: [],
  };
  const events: LogEvent[] = [];
  text.split(/\r?\n/).forEach((raw, index) => {
    if (!raw.trim()) return;
    result.lines += 1;
    const parsed = parseLine(raw, index + 1, now);
    if (!parsed) {
      result.unreadable += 1;
      return;
    }
    result.formats[parsed.format] += 1;
    if (parsed.event) events.push(parsed.event);
  });

  for (const e of events) {
    result.byType[e.type] = (result.byType[e.type] ?? 0) + 1;
    if (!result.firstAt || e.occurredAt < result.firstAt) result.firstAt = e.occurredAt;
    if (!result.lastAt || e.occurredAt > result.lastAt) result.lastAt = e.occurredAt;
  }
  result.events = events.length;
  result.findings = analyzeEvents(events, source);
  return result;
}
