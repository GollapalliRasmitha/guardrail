import { NextResponse } from "next/server";

/** Liveness check: no database call, so it's always fast. */
export function GET() {
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
