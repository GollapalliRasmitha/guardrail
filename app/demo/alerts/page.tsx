import type { Metadata } from "next";
import { AlertList } from "@/components/alerts/AlertList";
import { PageHeader } from "@/components/shell/AppShell";
import { Panel } from "@/components/ui/Panel";
import { demoWorldForRequest } from "@/lib/demo/request";

export const metadata: Metadata = { title: "Alerts" };

export default function DemoAlertsPage() {
  const { alerts } = demoWorldForRequest();
  return (
    <>
      <PageHeader eyebrow="Detection" title="Alerts" />
      <Panel>
        <AlertList alerts={alerts} label="Alerts (demo data), most recent first" base="/demo" />
      </Panel>
    </>
  );
}
