import { describe, expect, it } from "vitest";
import { analyzeLog } from "./analyze";

const now = new Date("2026-10-21T12:00:00Z");

/** An auth.log line at 10:mm:ss UTC. */
function ssh(minute: number, second: number, message: string) {
  const t = `${String(minute).padStart(2, "0")}:${String(second).padStart(2, "0")}`;
  return `Oct 21 10:${t} web1 sshd[812]: ${message}`;
}
/** An access-log line at 10:mm:ss UTC. */
function req(minute: number, second: number, ip: string, request: string, status: number) {
  const t = `${String(minute).padStart(2, "0")}:${String(second).padStart(2, "0")}`;
  return `${ip} - - [21/Oct/2026:10:${t} +0000] "${request} HTTP/1.1" ${status} 10 "-" "curl/8"`;
}

describe("analyzeLog: the same rules as live events, run in memory", () => {
  it("finds brute force on one account (T1110) and lists the lines", () => {
    const lines = Array.from({ length: 12 }, (_, i) =>
      ssh(1, i * 4, `Failed password for root from 203.0.113.${(i % 3) + 1} port 22 ssh2`),
    );
    const result = analyzeLog(lines.join("\n"), "homehaat", now);
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]).toMatchObject({
      ruleId: "brute_force",
      mitre: { id: "T1110" },
      severity: "high",
      title: "Brute force on root",
      events: 12,
    });
    expect(result.findings[0]!.lines.slice(0, 3)).toEqual([1, 2, 3]);
  });

  it("finds credential stuffing: one IP, many accounts (T1110.004)", () => {
    const users = ["admin", "test", "oracle", "ubuntu", "pi", "git"];
    const text = users.map((u, i) => ssh(2, i, `Invalid user ${u} from 198.51.100.66 port 1`)).join("\n");
    const result = analyzeLog(text, "homehaat", now);
    expect(result.findings.map((f) => f.ruleId)).toEqual(["credential_stuffing"]);
    expect(result.findings[0]!.subject).toBe("198.51.100.66");
  });

  it("finds scanning (medium for ≥ 5 paths, low for fewer) and a request flood (T1499)", () => {
    const scan = ["/.env", "/wp-admin/", "/.git/config", "/phpmyadmin/", "/xmlrpc.php"].map((p, i) =>
      req(3, i, "203.0.113.50", `GET ${p}`, 404),
    );
    const small = [req(3, 9, "203.0.113.51", "GET /.env", 404)];
    const flood = Array.from({ length: 55 }, (_, i) =>
      req(4, i, "198.51.100.9", "POST /api/auth/signin/", 429),
    );
    const result = analyzeLog([...scan, ...small, ...flood].join("\n"), "oppora", now);
    const byRule = Object.fromEntries(result.findings.map((f) => [`${f.ruleId}:${f.subject}`, f]));
    expect(byRule["scanning:203.0.113.50"]).toMatchObject({ severity: "medium", events: 5 });
    expect(byRule["scanning:203.0.113.51"]).toMatchObject({ severity: "low", events: 1 });
    expect(byRule["flood:198.51.100.9"]).toMatchObject({ severity: "medium", mitre: { id: "T1499" } });
  });

  it("finds a sign-in from a new IP (T1078) once the account has a usual IP", () => {
    const text = [
      ssh(5, 0, "Accepted publickey for rasmi from 198.51.100.4 port 1 ssh2"),
      ssh(6, 0, "Accepted publickey for rasmi from 198.51.100.4 port 1 ssh2"),
      ssh(7, 0, "Accepted password for rasmi from 203.0.113.99 port 1 ssh2"),
    ].join("\n");
    const result = analyzeLog(text, "homehaat", now);
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]).toMatchObject({ ruleId: "new_ip_login", severity: "medium", lines: [3] });
  });

  it("reports one finding per attack, even when it comes back in several bursts", () => {
    const burst = (minute: number) =>
      ["/.env", "/wp-admin/"].map((p, i) => req(minute, i, "203.0.113.70", `GET ${p}`, 404));
    const text = [...burst(10), ...burst(30), ...burst(50)].join("\n");
    const result = analyzeLog(text, "homehaat", now);
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]).toMatchObject({ events: 6, severity: "low" });
    expect(result.findings[0]!.firstSeen.toISOString()).toBe("2026-10-21T10:10:00.000Z");
    expect(result.findings[0]!.lastSeen.toISOString()).toBe("2026-10-21T10:50:01.000Z");
  });

  it("counts what it read: formats, ordinary lines, unreadable lines, events by type; lines in any order", () => {
    const text = [
      req(1, 0, "203.0.113.1", "GET /", 200),
      "not a log line",
      "",
      ssh(0, 0, "Invalid user a from 203.0.113.2 port 1"),
      req(0, 30, "203.0.113.1", "GET /.env", 404),
    ].join("\r\n");
    const result = analyzeLog(text, "homehaat", now);
    expect(result).toMatchObject({
      lines: 4, // blank lines aren't counted
      formats: { access: 2, auth: 1 },
      unreadable: 1,
      events: 2,
      byType: { login_failed: 1, suspicious_path: 1 },
    });
    expect(result.firstAt?.toISOString()).toBe("2026-10-21T10:00:00.000Z");
  });
});
