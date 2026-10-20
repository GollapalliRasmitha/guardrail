import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { verifyPasswordOrDummy } from "@/lib/auth/password";
import { loginAllowed, pruneOldAttempts, recordAttempt } from "@/lib/auth/rate-limit";
import { createSession, pruneExpiredSessions } from "@/lib/auth/session";
import { privacyHash } from "@/lib/crypto";
import { db, schema } from "@/lib/db";
import { clientIp, jsonError, readJson, sameOrigin } from "@/lib/http/request";
import { signInBody, type SignInResponse } from "@/lib/validation/auth";

const WRONG = "Email or password is wrong.";

/** Step 1 of sign-in: email + password. Success gives a short "password only" session; the 2FA code comes next. */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return jsonError(403, "bad_origin", "This request didn't come from GuardRail.");

  const parsed = signInBody.safeParse(await readJson(request));
  if (!parsed.success) return jsonError(400, "invalid", WRONG);
  const { email, password } = parsed.data;

  const ipHash = privacyHash(clientIp(request));
  const emailHash = privacyHash(email);

  const limit = await loginAllowed({ ipHash, emailHash, kind: "password" });
  if (!limit.allowed) {
    return jsonError(429, "rate_limited", "Too many tries. Wait a few minutes and try again.", {
      retryAfterSec: limit.retryAfterSec,
    });
  }

  const [user] = await db().select().from(schema.adminUser).where(eq(schema.adminUser.email, email)).limit(1);
  // Same work, same message and the same time whether or not the email exists.
  const ok = await verifyPasswordOrDummy(user?.passwordHash ?? null, password);
  await recordAttempt({ ipHash, emailHash, kind: "password", ok });
  if (!ok || !user) return jsonError(401, "wrong_credentials", WRONG);

  await createSession({
    userId: user.id,
    mfaPassed: false,
    ipHash,
    userAgent: request.headers.get("user-agent") ?? "",
  });
  await Promise.all([pruneOldAttempts(), pruneExpiredSessions()]);

  return NextResponse.json<SignInResponse>({ next: user.totpEnabled ? "code" : "setup-2fa" });
}
