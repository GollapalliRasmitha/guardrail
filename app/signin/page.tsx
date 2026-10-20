import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth/AuthCard";
import { SignInForm } from "@/components/auth/SignInForm";
import { getCurrentSession } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

export default async function SignInPage() {
  const current = await getCurrentSession();
  if (current?.state === "active") redirect("/dashboard");
  if (current?.state === "needs-2fa" && !current.user.totpEnabled) redirect("/setup-2fa");
  // Password already accepted in this browser (e.g. the page was refreshed): go straight to the code.
  const startAt = current?.state === "needs-2fa" ? "code" : "password";

  return (
    <AuthCard eyebrow="GuardRail console" title="Sign in">
      <SignInForm startAt={startAt} />
    </AuthCard>
  );
}
