import { FileUp } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/AppShell";
import { EmptyState } from "@/components/ui/EmptyState";
import { requireActiveSession } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Log upload" };

export default async function UploadPage() {
  await requireActiveSession();
  return (
    <>
      <PageHeader eyebrow="Offline analysis" title="Log upload" />
      <EmptyState icon={<FileUp className="size-6" />} title="Log upload is coming">
        Upload an nginx or Apache access log, or a Linux auth.log, and GuardRail will run the same detection
        rules on it.
      </EmptyState>
    </>
  );
}
