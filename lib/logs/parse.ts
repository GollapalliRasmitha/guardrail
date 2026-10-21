// [KEY LOGIC] Reading server log files, line by line, into the same events HomeHaat and Oppora send.
//
// Two formats are understood:
//   access logs (nginx's default and Apache's "combined" / "common"):
//     203.0.113.5 - - [21/Oct/2026:10:15:32 +0530] "GET /wp-login.php HTTP/1.1" 404 153 "-" "Mozilla/5.0"
//   Linux auth.log (sshd), with the classic or the newer ISO time:
//     Oct 21 10:15:32 web1 sshd[812]: Invalid user admin from 203.0.113.9 port 51234
// Pure functions (no file, no database), so every pattern is unit-tested.

import { isIP } from "node:net";
import type { EventType } from "@/lib/events/types";
import { maskActor } from "@/lib/ingest/schema";

export type LogEvent = {
  line: number;
  type: EventType;
  occurredAt: Date;
  ip: string | null;
  actor: string | null;
  method: string | null;
  path: string | null;
  statusCode: number | null;
};

/** null = not a line we understand; `event: null` = a normal line of a known format (nothing security-related). */
export type ParsedLine = { format: "access" | "auth"; event: LogEvent | null } | null;

// The same scanner paths HomeHaat's middleware watches (backend/guardrail/middleware.py).
const SUSPICIOUS =
  /^\/(wp-admin|wp-login\.php|wp-content|wp-includes|xmlrpc\.php|\.env|\.git|\.aws|\.ssh|\.DS_Store|phpmyadmin|pma|cgi-bin|server-status|vendor\/phpunit|actuator|boaform|config\.json|.*\.(php|asp|aspx|jsp|cgi|bak|sql)$)/i;
const SIGN_IN = /(log-?in|sign-?in|auth|session)/i;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// ip  ident  user  [time]  "request"  status  bytes  ("referrer" "agent")?   — quoted parts may contain \"
const QUOTED = String.raw`"((?:[^"\\]|\\.)*)"`;
const ACCESS = new RegExp(String.raw`^(\S+) \S+ \S+ \[([^\]]+)\] ${QUOTED} (\d{3}) \S+`);
const ACCESS_TIME = /^(\d{2})\/([A-Z][a-z]{2})\/(\d{4}):(\d{2}):(\d{2}):(\d{2}) ([+-])(\d{2})(\d{2})$/;

const SYSLOG_CLASSIC = /^([A-Z][a-z]{2}) {1,2}(\d{1,2}) (\d{2}):(\d{2}):(\d{2}) \S+ (.*)$/;
const SYSLOG_ISO = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(\.\d+)?(Z|[+-]\d{2}:\d{2}) \S+ (.*)$/;

const HOUR = 3_600_000;

const cleanIp = (value: string) => (isIP(value) ? value : null);
const cleanActor = (value: string) =>
  value ? (value.includes("@") ? maskActor(value) : value.slice(0, 64)) : null;

// ---- access logs ------------------------------------------------------------------------------------------------

function accessTime(text: string): Date | null {
  const m = ACCESS_TIME.exec(text);
  if (!m) return null;
  const month = MONTHS.indexOf(m[2]!);
  if (month < 0) return null;
  const utc = Date.UTC(+m[3]!, month, +m[1]!, +m[4]!, +m[5]!, +m[6]!);
  const offset = (m[7] === "-" ? -1 : 1) * (+m[8]! * HOUR + +m[9]! * 60_000);
  return new Date(utc - offset); // "10:15 at +05:30" is 04:45 UTC
}

/** "GET /a?b=1 HTTP/1.1" → method + path without the query; null for garbage (e.g. TLS bytes sent to port 80). */
function requestParts(request: string): { method: string; path: string } | null {
  const [method, target] = request.split(" ");
  if (!method || !target || !/^[A-Z]{3,10}$/.test(method)) return null;
  let path = target;
  if (/^https?:\/\//i.test(target)) {
    try {
      path = new URL(target).pathname; // a proxy-style absolute URL
    } catch {
      return null;
    }
  }
  if (!path.startsWith("/")) return null;
  return { method, path: path.split(/[?#]/, 1)[0]!.slice(0, 300) }; // query strings can carry tokens
}

function accessEventType(method: string, path: string, status: number): EventType | null {
  if (status === 429) return "rate_limited";
  if (SUSPICIOUS.test(path)) return "suspicious_path";
  if (method === "POST" && (status === 401 || status === 403) && SIGN_IN.test(path)) return "login_failed";
  return null;
}

function parseAccess(text: string, line: number): ParsedLine {
  const m = ACCESS.exec(text);
  if (!m) return null;
  const occurredAt = accessTime(m[2]!);
  if (!occurredAt) return null;
  const request = requestParts(m[3]!);
  const status = Number(m[4]);
  const type = request && accessEventType(request.method, request.path, status);
  if (!request || !type) return { format: "access", event: null };
  return {
    format: "access",
    event: {
      line,
      type,
      occurredAt,
      ip: cleanIp(m[1]!),
      actor: null,
      method: request.method,
      path: request.path,
      statusCode: status,
    },
  };
}

// ---- auth.log ---------------------------------------------------------------------------------------------------

/** The time of a syslog line. The classic format has no year and no time zone: read as UTC, never in the future. */
function syslogTime(text: string, now: Date): { at: Date; rest: string } | null {
  const iso = SYSLOG_ISO.exec(text);
  if (iso) {
    const ms = (iso[2] ?? "").slice(0, 4); // ".123456" → ".123" (JavaScript dates keep milliseconds)
    const at = new Date(`${iso[1]}${ms}${iso[3]}`);
    return Number.isNaN(at.getTime()) ? null : { at, rest: iso[4]! };
  }
  const m = SYSLOG_CLASSIC.exec(text);
  if (!m) return null;
  const month = MONTHS.indexOf(m[1]!);
  if (month < 0) return null;
  const parts = [month, +m[2]!, +m[3]!, +m[4]!, +m[5]!] as const;
  let at = new Date(Date.UTC(now.getUTCFullYear(), ...parts));
  if (at.getTime() > now.getTime() + 24 * HOUR) at = new Date(Date.UTC(now.getUTCFullYear() - 1, ...parts));
  return { at, rest: m[6]! };
}

const SSH_PATTERNS: { re: RegExp; type: EventType | null }[] = [
  // Counted once: the "Invalid user" line comes first, so the "Failed … for invalid user" line that follows is skipped.
  { re: /^Failed \S+ for invalid user /, type: null },
  { re: /^Invalid user (\S*) from (\S+)/, type: "login_failed" },
  { re: /^Failed \S+ for (\S+) from (\S+)/, type: "login_failed" },
  { re: /^Accepted \S+ for (\S+) from (\S+)/, type: "login_success" },
];

function parseAuth(text: string, line: number, now: Date): ParsedLine {
  const time = syslogTime(text, now);
  if (!time) return null;
  const program = /^(\S+?)(?:\[\d+\])?: (.*)$/.exec(time.rest);
  if (!program || program[1] !== "sshd") return { format: "auth", event: null };

  for (const { re, type } of SSH_PATTERNS) {
    const m = re.exec(program[2]!);
    if (!m) continue;
    if (!type) break;
    return {
      format: "auth",
      event: {
        line,
        type,
        occurredAt: time.at,
        ip: cleanIp(m[2]!),
        actor: cleanActor(m[1]!),
        method: null,
        path: null,
        statusCode: null,
      },
    };
  }
  return { format: "auth", event: null };
}

/** One line of a log file. `line` is its 1-based number (shown in the results so you can find it). */
export function parseLine(text: string, line: number, now: Date): ParsedLine {
  const trimmed = text.trim();
  if (!trimmed) return null;
  return parseAccess(trimmed, line) ?? parseAuth(trimmed, line, now);
}
