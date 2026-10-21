import type { Metadata } from "next";
import { LiveProvider } from "@/components/live/LiveProvider";
import { AccountFooter, AppShell } from "@/components/shell/AppShell";
import { activeAlertCounts } from "@/lib/alerts/query";
import { requireActiveSession } from "@/lib/auth/guards";
import { latestEventId } from "@/lib/events/query";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Checked here for the frame AND again in every page/API route: a layout check alone isn't enough, because
  // Next.js can render a page without re-running its parent layout on client navigation.
  const { user } = await requireActiveSession();
  // The live feed starts after the newest event that already exists, so pages don't get duplicates.
  const [cursor, alerts] = await Promise.all([latestEventId(), activeAlertCounts()]);
  return (
    <LiveProvider initialCursor={cursor}>
      <AppShell base="/dashboard" account={<AccountFooter email={user.email} />} openAlerts={alerts.total}>
        {children}
      </AppShell>
    </LiveProvider>
  );
}
