import "server-only";
import { and, eq, isNull, lt } from "drizzle-orm";
import { decryptSecret, encryptSecret, privacyHash } from "@/lib/crypto";
import { db, schema } from "@/lib/db";
import { clientIp } from "@/lib/http/request";
import { loginAllowed, recordAttempt, type LimitResult } from "./rate-limit";
import { endCurrentSession, upgradeSession, type CurrentSession } from "./session";
import { generateTotpSecret, verifyTotp } from "./totp";

export type CodeResult = { ok: true } | { ok: false; reason: "wrong" | "limited"; limit?: LimitResult };

/** The secret for the setup screen: the one already started, or a new one. Never replaces an enabled secret. */
export async function pendingSetupSecret(current: CurrentSession): Promise<string> {
  if (current.user.totpEnabled) throw new Error("2FA is already on");
  if (current.user.totpSecretEnc) return decryptSecret(current.user.totpSecretEnc);
  const secret = generateTotpSecret();
  // Only saved if no secret exists yet. If two requests race, the first wins and the second reads it back,
  // so the QR code on screen always matches the secret in the database.
  const saved = await db()
    .update(schema.adminUser)
    .set({ totpSecretEnc: encryptSecret(secret), updatedAt: new Date() })
    .where(and(eq(schema.adminUser.id, current.user.id), isNull(schema.adminUser.totpSecretEnc)))
    .returning({ id: schema.adminUser.id });
  if (saved.length === 1) return secret;
  const [row] = await db()
    .select({ enc: schema.adminUser.totpSecretEnc })
    .from(schema.adminUser)
    .where(eq(schema.adminUser.id, current.user.id));
  if (!row?.enc) throw new Error("2FA secret missing");
  return decryptSecret(row.enc);
}

/**
 * Check a 2FA code for the signed-in-with-password user, then swap to a full session.
 * Used both for normal sign-in and to confirm setup (`enable: true` turns 2FA on).
 */
export async function checkCodeAndUpgrade(
  current: CurrentSession,
  code: string,
  request: Request,
  options: { enable: boolean },
): Promise<CodeResult> {
  const ipHash = privacyHash(clientIp(request));
  const emailHash = privacyHash(current.user.email);
  const limit = await loginAllowed({ ipHash, emailHash, kind: "totp" });
  if (!limit.allowed) return { ok: false, reason: "limited", limit };

  const secretEnc = current.user.totpSecretEnc;
  const step = secretEnc
    ? verifyTotp({
        secret: decryptSecret(secretEnc),
        code,
        nowMs: Date.now(),
        lastUsedStep: current.user.totpLastStep,
      })
    : null;

  // Save the used step with a condition, so two requests racing with the same code can't both win:
  // the database only accepts the UPDATE if no equal-or-newer step was saved in the meantime.
  let accepted = false;
  if (step !== null) {
    const updated = await db()
      .update(schema.adminUser)
      .set({ totpLastStep: step, updatedAt: new Date(), ...(options.enable ? { totpEnabled: true } : {}) })
      .where(and(eq(schema.adminUser.id, current.user.id), lt(schema.adminUser.totpLastStep, step)))
      .returning({ id: schema.adminUser.id });
    accepted = updated.length === 1;
  }

  await recordAttempt({ ipHash, emailHash, kind: "totp", ok: accepted });
  if (!accepted) return { ok: false, reason: "wrong" };

  await upgradeSession(current, ipHash, request.headers.get("user-agent") ?? "");
  return { ok: true };
}

/** After too many wrong codes the half-signed-in session is thrown away: start again from the password. */
export async function abandonPendingSession() {
  await endCurrentSession();
}
