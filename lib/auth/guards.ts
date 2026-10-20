import "server-only";
import { redirect } from "next/navigation";
import { getCurrentSession, type CurrentSession } from "./session";

/** For every dashboard page and layout: signed in AND 2FA passed, or off to the sign-in page. */
export async function requireActiveSession(): Promise<CurrentSession> {
  const current = await getCurrentSession();
  if (!current) redirect("/signin");
  if (current.state === "needs-2fa") redirect(current.user.totpEnabled ? "/signin" : "/setup-2fa");
  return current;
}
