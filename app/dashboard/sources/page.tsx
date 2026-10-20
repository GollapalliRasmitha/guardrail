import { Server } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/AppShell";
import { EmptyState } from "@/components/ui/EmptyState";
import { requireActiveSession } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Sources" };

export default async function SourcesPage() {
  await requireActiveSession();
  return (
    <>
      <PageHeader eyebrow="Connected sites" title="Sources" />
      <EmptyState icon={<Server className="size-6" />} title="No sources connected">
        HomeHaat and Oppora will each get their own signing secret. This page will show when each one last
        sent an event and how many arrived today.
      </EmptyState>
    </>
  );
}
