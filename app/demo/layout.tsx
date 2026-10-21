import { FlaskConical, LogIn } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { DemoLiveProvider } from "@/components/live/DemoLiveProvider";
import { AppShell } from "@/components/shell/AppShell";
import { demoWorldForRequest } from "@/lib/demo/request";

export const metadata: Metadata = {
  title: { default: "Demo", template: "%s · Demo · GuardRail" },
  description: "GuardRail's dashboard with made-up data: read-only, nothing is real.",
};

/** The public demo: the real dashboard's pages and components, with made-up data and no way to change anything. */
export default function DemoLayout({ children }: { children: React.ReactNode }) {
  const world = demoWorldForRequest();
  return (
    <DemoLiveProvider initialCursor={world.events.at(-1)!.id}>
      <AppShell
        base="/demo"
        openAlerts={world.overview.alertCounts.total}
        banner={
          <p
            role="note"
            className="flex flex-wrap items-center justify-center gap-x-2 border-b border-sev-medium/30 bg-sev-medium/10 px-4 py-2 text-center text-sm text-sev-medium"
          >
            <FlaskConical className="size-4 shrink-0" aria-hidden />
            <strong className="font-semibold">Demo data.</strong> Everything here is made up, and nothing can
            be changed.
          </p>
        }
        account={
          <>
            <p className="px-3 pb-2 font-mono text-xs text-muted">Demo · read-only</p>
            <Link
              href="/signin"
              className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm text-muted hover:bg-panel-2 hover:text-text"
            >
              <LogIn className="size-4.5" aria-hidden /> Owner sign-in
            </Link>
          </>
        }
      >
        {children}
      </AppShell>
    </DemoLiveProvider>
  );
}
