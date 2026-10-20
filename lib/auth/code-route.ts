import "server-only";
import { NextResponse } from "next/server";
import { jsonError, readJson, sameOrigin } from "@/lib/http/request";
import { codeBody, type SignInResponse } from "@/lib/validation/auth";
import { getCurrentSession } from "./session";
import { abandonPendingSession, checkCodeAndUpgrade } from "./two-factor";

/** Shared by "enter your code" (2FA already on) and "confirm setup" (turning 2FA on). */
export async function handleCodeRequest(request: Request, mode: "verify" | "setup") {
  if (!sameOrigin(request)) return jsonError(403, "bad_origin", "This request didn't come from GuardRail.");

  const current = await getCurrentSession();
  if (!current || current.state !== "needs-2fa") {
    return jsonError(401, "no_pending_signin", "Your sign-in timed out. Enter your password again.");
  }
  // "verify" only when 2FA is on; "setup" only while it's still off. Setup can never replace an existing secret.
  if (current.user.totpEnabled !== (mode === "verify")) {
    return jsonError(409, "wrong_step", "Please start sign-in again.");
  }

  const parsed = codeBody.safeParse(await readJson(request));
  if (!parsed.success)
    return jsonError(400, "invalid", "Enter the 6-digit code from your authenticator app.");

  const result = await checkCodeAndUpgrade(current, parsed.data.code, request, { enable: mode === "setup" });
  if (!result.ok && result.reason === "limited") {
    await abandonPendingSession();
    const retryAfterSec = result.limit && !result.limit.allowed ? result.limit.retryAfterSec : undefined;
    return jsonError(429, "rate_limited", "Too many wrong codes. Wait a few minutes, then sign in again.", {
      retryAfterSec,
    });
  }
  if (!result.ok)
    return jsonError(401, "wrong_code", "That code isn't right. Codes change every 30 seconds.");
  return NextResponse.json<SignInResponse>({ next: "dashboard" });
}
