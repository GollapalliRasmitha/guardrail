import { ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { SignOutEverywhere } from "@/components/settings/SignOutEverywhere";
import { PageHeader } from "@/components/shell/AppShell";
import { Mono } from "@/components/ui/Mono";
import { Panel } from "@/components/ui/Panel";
import { requireActiveSession } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { user } = await requireActiveSession();
  return (
    <>
      <PageHeader eyebrow="Account" title="Settings" />
      <div className="grid max-w-3xl gap-6">
        <Panel title="Account">
          <dl className="space-y-3 text-sm">
            <div className="flex flex-wrap justify-between gap-2">
              <dt className="text-muted">Email</dt>
              <dd>
                <Mono>{user.email}</Mono>
              </dd>
            </div>
            <div className="flex flex-wrap justify-between gap-2">
              <dt className="text-muted">Two-factor authentication</dt>
              <dd className="inline-flex items-center gap-1.5 text-ok">
                <ShieldCheck className="size-4" aria-hidden /> On (authenticator app)
              </dd>
            </div>
          </dl>
          <p className="mt-4 text-sm text-muted">
            To change the password run <Mono className="text-text">npm run admin:create</Mono> in a terminal.
            Lost your phone? Run <Mono className="text-text">npm run admin:reset-2fa</Mono>.
          </p>
        </Panel>
        <Panel title="Sessions">
          <p className="mb-4 text-sm text-muted">
            Signs out every device, including this one. Use it if a laptop or phone is lost.
          </p>
          <SignOutEverywhere />
        </Panel>
      </div>
    </>
  );
}
