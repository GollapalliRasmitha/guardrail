import "server-only";
import { jsonError, sameOrigin } from "@/lib/http/request";
import { getCurrentSession } from "./session";

/**
 * For every dashboard API route that changes something: same-site request (CSRF) and a full, 2FA-passed session.
 * Returns an error response to send back, or null when the request may go ahead.
 */
export async function guardChange(request: Request): Promise<Response | null> {
  if (!sameOrigin(request)) return jsonError(403, "bad_origin", "This request didn't come from GuardRail.");
  const current = await getCurrentSession();
  if (!current || current.state !== "active") return jsonError(401, "signed_out", "Please sign in again.");
  return null;
}
