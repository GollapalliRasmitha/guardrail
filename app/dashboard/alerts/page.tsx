import { Bell } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/AppShell";
import { EmptyState } from "@/components/ui/EmptyState";
import { requireActiveSession } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Alerts" };

export default async function AlertsPage() {
  await requireActiveSession();
  return (
    <>
      <PageHeader eyebrow="Detection" title="Alerts" />
      <EmptyState icon={<Bell className="size-6" />} title="No alerts">
        When a detection rule fires (brute force, credential stuffing, forged webhooks, scanning, floods, a
        sign-in from a new IP), the alert appears here with its MITRE ATT&amp;CK technique, severity and
        timeline.
      </EmptyState>
    </>
  );
}
