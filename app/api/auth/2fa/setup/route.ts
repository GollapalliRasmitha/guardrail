import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { getCurrentSession } from "@/lib/auth/session";
import { otpauthUrl } from "@/lib/auth/totp";
import { pendingSetupSecret } from "@/lib/auth/two-factor";
import { jsonError, sameOrigin } from "@/lib/http/request";
import type { SetupStartResponse } from "@/lib/validation/auth";

/**
 * First sign-in only: start 2FA setup and return the QR code. POST, not GET, because it may create the secret.
 * Allowed only with a "password OK, 2FA not set up yet" session. Once 2FA is on, this always refuses.
 */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return jsonError(403, "bad_origin", "This request didn't come from GuardRail.");
  const current = await getCurrentSession();
  if (!current || current.state !== "needs-2fa") {
    return jsonError(401, "no_pending_signin", "Your sign-in timed out. Enter your password again.");
  }
  if (current.user.totpEnabled) return jsonError(409, "already_enabled", "2FA is already set up.");

  const secret = await pendingSetupSecret(current);
  const url = otpauthUrl({ secret, account: current.user.email, issuer: "GuardRail" });
  const qrDataUrl = await QRCode.toDataURL(url, { margin: 1, width: 240, errorCorrectionLevel: "M" });
  return NextResponse.json<SetupStartResponse>(
    { qrDataUrl, secret, account: current.user.email },
    { headers: { "Cache-Control": "no-store" } },
  );
}
