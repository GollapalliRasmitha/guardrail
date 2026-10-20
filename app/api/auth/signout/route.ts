import { NextResponse } from "next/server";
import { endCurrentSession } from "@/lib/auth/session";
import { jsonError, sameOrigin } from "@/lib/http/request";
import type { OkResponse } from "@/lib/validation/auth";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return jsonError(403, "bad_origin", "This request didn't come from GuardRail.");
  await endCurrentSession();
  return NextResponse.json<OkResponse>({ ok: true });
}
