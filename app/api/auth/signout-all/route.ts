import { NextResponse } from "next/server";
import { endAllSessions, getCurrentSession } from "@/lib/auth/session";
import { jsonError, sameOrigin } from "@/lib/http/request";
import type { OkResponse } from "@/lib/validation/auth";

/** Sign out on every device (e.g. after losing a laptop). */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return jsonError(403, "bad_origin", "This request didn't come from GuardRail.");
  const current = await getCurrentSession();
  if (!current || current.state !== "active") return jsonError(401, "signed_out", "Please sign in.");
  await endAllSessions(current.user.id);
  return NextResponse.json<OkResponse>({ ok: true });
}
