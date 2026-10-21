import type { Metadata } from "next";
import { LogUpload } from "@/components/logs/LogUpload";
import { PageHeader } from "@/components/shell/AppShell";
import { requireActiveSession } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Log upload" };

export default async function UploadPage() {
  await requireActiveSession();
  return (
    <>
      <PageHeader eyebrow="Offline analysis" title="Log upload" />
      <p className="mb-6 max-w-3xl text-muted">
        Check a server log with the same six detection rules that watch HomeHaat and Oppora live: brute force,
        credential stuffing, scanning, request floods and sign-ins from new IPs.
      </p>
      <LogUpload />
    </>
  );
}
