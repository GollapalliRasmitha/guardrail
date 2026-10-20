import type { Metadata } from "next";
import { AppShell } from "@/components/shell/AppShell";
import { requireActiveSession } from "@/lib/auth/guards";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Checked here for the frame AND again in every page/API route: a layout check alone isn't enough, because
  // Next.js can render a page without re-running its parent layout on client navigation.
  const { user } = await requireActiveSession();
  return <AppShell email={user.email}>{children}</AppShell>;
}
