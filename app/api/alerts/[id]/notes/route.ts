import { NextResponse } from "next/server";
import { addNote } from "@/lib/alerts/store";
import { guardChange } from "@/lib/auth/api-guard";
import { jsonError, readJson } from "@/lib/http/request";
import { alertId, noteBody } from "@/lib/validation/alerts";
import type { OkResponse } from "@/lib/validation/auth";

/** Add a note to an alert's timeline ("blocked the IP at Render", "false alarm: my new phone"). */
export async function POST(request: Request, ctx: RouteContext<"/api/alerts/[id]/notes">) {
  const refused = await guardChange(request);
  if (refused) return refused;

  const id = alertId.safeParse((await ctx.params).id);
  if (!id.success) return jsonError(404, "not_found", "No such alert.");
  const body = noteBody.safeParse(await readJson(request));
  if (!body.success) return jsonError(400, "invalid", body.error.issues[0]?.message ?? "Write a note first.");

  if (!(await addNote(id.data, body.data.note))) return jsonError(404, "not_found", "No such alert.");
  return NextResponse.json<OkResponse>({ ok: true });
}
