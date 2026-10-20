import { Activity } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/AppShell";
import { EmptyState } from "@/components/ui/EmptyState";
import { requireActiveSession } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Events" };

export default async function EventsPage() {
  await requireActiveSession();
  return (
    <>
      <PageHeader eyebrow="Telemetry" title="Events" />
      <EmptyState icon={<Activity className="size-6" />} title="No events yet">
        Every failed login, scan, forged webhook and rate-limit hit from HomeHaat and Oppora will be listed
        here, live, with filters by source and type, search and pages.
      </EmptyState>
    </>
  );
}
