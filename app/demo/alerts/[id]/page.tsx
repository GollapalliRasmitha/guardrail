import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { IncidentView } from "@/components/views/IncidentView";
import { demoWorldForRequest } from "@/lib/demo/request";

export const metadata: Metadata = { title: "Incident" };

const readOnly = (what: string) => (
  <p className="rounded-lg border border-line px-3 py-2 text-sm text-muted">
    Demo: {what} are switched off here. In the real dashboard they work.
  </p>
);

export default async function DemoAlertPage({ params }: PageProps<"/demo/alerts/[id]">) {
  const world = demoWorldForRequest();
  const { id } = await params;
  const alert = world.alerts.find((a) => String(a.id) === id);
  if (!alert) notFound();
  return (
    <IncidentView
      base="/demo"
      alert={alert}
      activity={world.activity(alert.id)}
      events={world.evidence(alert.id)}
      actions={readOnly("Acknowledge and Resolve")}
      noteForm={readOnly("notes")}
    />
  );
}
