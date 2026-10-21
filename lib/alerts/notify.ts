import "server-only";
import { and, count, eq, gt, isNull } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import type { AlertRow } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { buildAlertEmail, emailDecision } from "./email";
import { addActivity } from "./store";

const DEFAULT_FROM = "GuardRail <onboarding@resend.dev>"; // Resend's test sender: free, only to your own address

/**
 * Email a high alert once (Resend's free HTTP API; no SDK needed). Never throws: a mail problem must not break
 * detection. The outcome always lands on the alert's timeline, including "not set up" and "daily cap reached".
 */
export async function notifyIfNeeded(alert: AlertRow): Promise<void> {
  try {
    const { RESEND_API_KEY, ALERT_EMAIL_TO, ALERT_EMAIL_FROM, APP_URL } = env();
    const [sent] = await db()
      .select({ n: count() })
      .from(schema.alertActivity)
      .where(
        and(
          eq(schema.alertActivity.kind, "email_sent"),
          gt(schema.alertActivity.createdAt, new Date(Date.now() - 86_400_000)),
        ),
      );
    const decision = emailDecision({
      severity: alert.severity,
      emailedAt: alert.emailedAt,
      sentLast24h: sent?.n ?? 0,
      configured: Boolean(RESEND_API_KEY && ALERT_EMAIL_TO),
    });

    if (!decision.send) {
      if (decision.reason === "not_configured" || decision.reason === "daily_cap")
        await noteSkipOnce(alert.id, decision.reason);
      return;
    }

    // Claim the alert first, so two detections at once can't both send (only one UPDATE matches emailed_at IS NULL).
    const [claimed] = await db()
      .update(schema.alert)
      .set({ emailedAt: new Date() })
      .where(and(eq(schema.alert.id, alert.id), isNull(schema.alert.emailedAt)))
      .returning({ id: schema.alert.id });
    if (!claimed) return;

    const message = buildAlertEmail(alert, APP_URL);
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: ALERT_EMAIL_FROM || DEFAULT_FROM, to: [ALERT_EMAIL_TO], ...message }),
      signal: AbortSignal.timeout(5000),
    }).catch(() => null);

    if (response?.ok) {
      await addActivity(alert.id, "email_sent");
    } else {
      // Give the claim back so a later update of this alert can try again.
      await db().update(schema.alert).set({ emailedAt: null }).where(eq(schema.alert.id, alert.id));
      await addActivity(alert.id, "email_failed", { status: response?.status ?? null });
    }
  } catch (error) {
    console.error("Alert email step failed:", error instanceof Error ? error.message : error);
  }
}

/** "Email not sent: not set up" goes on the timeline once per alert, not on every update. */
async function noteSkipOnce(alertId: number, reason: string) {
  const [already] = await db()
    .select({ n: count() })
    .from(schema.alertActivity)
    .where(and(eq(schema.alertActivity.alertId, alertId), eq(schema.alertActivity.kind, "email_skipped")));
  if ((already?.n ?? 0) === 0) await addActivity(alertId, "email_skipped", { reason });
}
