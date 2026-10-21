import { Activity } from "lucide-react";
import type { Metadata } from "next";
import { LiveEventList } from "@/components/events/LiveEventList";
import { PageHeader } from "@/components/shell/AppShell";
import { EmptyState } from "@/components/ui/EmptyState";
import { Panel } from "@/components/ui/Panel";
import { demoWorldForRequest } from "@/lib/demo/request";

export const metadata: Metadata = { title: "Events" };

export default function DemoEventsPage() {
  const { events } = demoWorldForRequest();
  return (
    <>
      <PageHeader eyebrow="Telemetry" title="Events" />
      <Panel>
        <LiveEventList
          initial={events.slice(-100).reverse()}
          max={100}
          caption="Security events (demo data), newest first"
          empty={
            <EmptyState icon={<Activity className="size-6" />} title="No events">
              Nothing to show.
            </EmptyState>
          }
        />
        <p className="mt-4 text-xs text-muted">
          The newest 100 of {events.length} made-up events. The real dashboard adds filters, search and pages.
        </p>
      </Panel>
    </>
  );
}
