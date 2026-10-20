import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth/AuthCard";
import { SetupTwoFactor } from "@/components/auth/SetupTwoFactor";
import { getCurrentSession } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Set up 2FA", robots: { index: false } };

/** First sign-in only: password accepted, 2FA not set up yet. */
export default async function SetupTwoFactorPage() {
  const current = await getCurrentSession();
  if (!current) redirect("/signin");
  if (current.state === "active") redirect("/dashboard");
  if (current.user.totpEnabled) redirect("/signin");

  return (
    <AuthCard eyebrow="One-time setup" title="Turn on 2FA">
      <SetupTwoFactor />
    </AuthCard>
  );
}
