import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { jsonError } from "@/lib/http/request";
import { runRetention } from "@/lib/retention";
import { bearerMatches } from "@/lib/retention-rules";

/**
 * Daily clean-up, called by Vercel Cron (vercel.json). Vercel sends "Authorization: Bearer <CRON_SECRET>" by itself
 * when CRON_SECRET is set in the project's settings; without that secret everything is refused.
 */
export async function GET(request: Request) {
  if (!bearerMatches(request.headers.get("authorization"), env().CRON_SECRET)) {
    return jsonError(401, "unauthorized", "Unauthorized.");
  }
  const result = await runRetention();
  console.info("Retention:", JSON.stringify(result));
  return NextResponse.json(result);
}
