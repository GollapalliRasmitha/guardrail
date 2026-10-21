import { describe, expect, it } from "vitest";
import { parseLine } from "./parse";

const now = new Date("2026-10-21T12:00:00Z");
const access = (request: string, status: number, ip = "203.0.113.5") =>
  `${ip} - - [21/Oct/2026:10:15:32 +0530] "${request}" ${status} 153 "-" "Mozilla/5.0 (X11; Linux x86_64)"`;

describe("parseLine: nginx / Apache access logs (combined and common format)", () => {
  it("reads a scanner request as suspicious_path, with the time zone applied and the query string removed", () => {
    expect(parseLine(access("GET /wp-login.php?redirect=x HTTP/1.1", 404), 1, now)).toEqual({
      format: "access",
      event: {
        line: 1,
        type: "suspicious_path",
        occurredAt: new Date("2026-10-21T04:45:32Z"), // 10:15:32 at +05:30
        ip: "203.0.113.5",
        actor: null,
        method: "GET",
        path: "/wp-login.php",
        statusCode: 404,
      },
    });
  });

  it("reads 429 as rate_limited and a refused sign-in POST as login_failed", () => {
    expect(parseLine(access("POST /api/auth/signin/ HTTP/1.1", 429), 2, now)?.event?.type).toBe(
      "rate_limited",
    );
    expect(parseLine(access("POST /api/auth/signin/ HTTP/1.1", 401), 3, now)?.event?.type).toBe(
      "login_failed",
    );
    expect(parseLine(access("POST /accounts/login HTTP/2.0", 403), 4, now)?.event?.type).toBe("login_failed");
  });

  it("recognises ordinary requests without making an event", () => {
    expect(parseLine(access("GET / HTTP/1.1", 200), 5, now)).toEqual({ format: "access", event: null });
    expect(parseLine(access("GET /api/auth/signin/ HTTP/1.1", 401), 6, now)?.event).toBeNull(); // GET, not a sign-in try
  });

  it("accepts IPv6 clients, the common format (no referrer / agent) and garbage request lines", () => {
    const v6 = parseLine(access("GET /.env HTTP/1.1", 404, "2001:db8::7"), 7, now);
    expect(v6?.event?.ip).toBe("2001:db8::7");
    const common = parseLine(
      '198.51.100.4 - - [21/Oct/2026:10:15:32 +0000] "GET /.git/config HTTP/1.1" 404 0',
      8,
      now,
    );
    expect(common?.event?.type).toBe("suspicious_path");
    const tls = parseLine(access("\\x16\\x03\\x01\\x00\\xa5", 400), 9, now);
    expect(tls).toEqual({ format: "access", event: null });
  });
});

describe("parseLine: Linux auth.log (sshd)", () => {
  it("reads 'Invalid user' and 'Failed password' as login_failed with the account name", () => {
    const invalid = parseLine(
      "Oct 21 10:15:32 web1 sshd[812]: Invalid user admin from 203.0.113.9 port 51234",
      1,
      now,
    );
    expect(invalid).toEqual({
      format: "auth",
      event: {
        line: 1,
        type: "login_failed",
        occurredAt: new Date("2026-10-21T10:15:32Z"), // no time zone in the line: read as UTC
        ip: "203.0.113.9",
        actor: "admin",
        method: null,
        path: null,
        statusCode: null,
      },
    });
    const failed = parseLine(
      "Oct 21 10:15:40 web1 sshd[812]: Failed password for root from 203.0.113.9 port 22 ssh2",
      2,
      now,
    );
    expect(failed?.event).toMatchObject({ type: "login_failed", actor: "root", ip: "203.0.113.9" });
  });

  it("doesn't count 'Failed password for invalid user' twice (its 'Invalid user' line was already counted)", () => {
    const line =
      "Oct 21 10:15:33 web1 sshd[812]: Failed password for invalid user admin from 203.0.113.9 port 51234 ssh2";
    expect(parseLine(line, 1, now)).toEqual({ format: "auth", event: null });
  });

  it("reads 'Accepted' as login_success, and the newer ISO time format", () => {
    const line =
      "2026-10-21T15:45:00.123456+05:30 web1 sshd[900]: Accepted publickey for rasmi from 198.51.100.4 port 50000 ssh2";
    expect(parseLine(line, 1, now)?.event).toMatchObject({
      type: "login_success",
      actor: "rasmi",
      ip: "198.51.100.4",
      occurredAt: new Date("2026-10-21T10:15:00.123Z"),
    });
  });

  it("puts a date without a year in the past (31 Dec read in October is last year's)", () => {
    const line = "Dec 31 23:59:59 web1 sshd[1]: Invalid user test from 203.0.113.9 port 1";
    expect(parseLine(line, 1, now)?.event?.occurredAt.toISOString()).toBe("2025-12-31T23:59:59.000Z");
  });

  it("recognises other auth.log lines without making an event, and refuses anything else", () => {
    expect(parseLine("Oct 21 10:15:32 web1 CRON[5]: pam_unix(cron:session): session opened", 1, now)).toEqual(
      {
        format: "auth",
        event: null,
      },
    );
    expect(parseLine("hello world", 2, now)).toBeNull();
    expect(parseLine("", 3, now)).toBeNull();
  });
});
