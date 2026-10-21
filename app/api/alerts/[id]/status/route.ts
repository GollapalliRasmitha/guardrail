import { NextResponse } from "next/server";
import { changeStatus } from "@/lib/alerts/store";
import { guardChange } from "@/lib/auth/api-guard";
import { jsonError, readJson } from "@/lib/http/request";
import { alertId, statusBody } from "@/lib/validation/alerts";

export type StatusResponse = { status: string };

/** Acknowledge / resolve / reopen an alert. Only the moves in lib/alerts/status.ts are allowed. */
export async function POST(request: Request, ctx: RouteContext<"/api/alerts/[id]/status">) {
  const refused = await guardChange(request);
  if (refused) return refused;

  const id = alertId.safeParse((await ctx.params).id);
  if (!id.success) return jsonError(404, "not_found", "No such alert.");
  const body = statusBody.safeParse(await readJson(request));
  if (!body.success) return jsonError(400, "invalid", "Choose open, acknowledged or resolved.");

  const result = await changeStatus(id.data, body.data.status);
  if (result.ok) return NextResponse.json<StatusResponse>({ status: result.alert.status });
  if (result.reason === "not_found") return jsonError(404, "not_found", "No such alert.");
  if (result.reason === "newer_open_alert") {
    return jsonError(
      409,
      "newer_open_alert",
      `A newer alert for the same attack is open (#${result.newerId}). Continue there.`,
    );
  }
  return jsonError(409, "not_allowed", "That status change isn't allowed from here.");
}
