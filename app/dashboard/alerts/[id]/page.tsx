import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AlertActions } from "@/components/alerts/AlertActions";
import { NoteForm } from "@/components/alerts/NoteForm";
import { RefreshOnEvents } from "@/components/live/RefreshOnEvents";
import { IncidentView } from "@/components/views/IncidentView";
import { alertDetail } from "@/lib/alerts/query";
import { requireActiveSession } from "@/lib/auth/guards";
import { alertId } from "@/lib/validation/alerts";

export const metadata: Metadata = { title: "Incident" };

export default async function AlertPage({ params }: PageProps<"/dashboard/alerts/[id]">) {
  await requireActiveSession();
  const id = alertId.safeParse((await params).id);
  if (!id.success) notFound();
  const detail = await alertDetail(id.data);
  if (!detail) notFound();
  const { alert, activity, events } = detail;

  return (
    <>
      <RefreshOnEvents />
      <IncidentView
        base="/dashboard"
        alert={alert}
        activity={activity}
        events={events}
        actions={<AlertActions id={alert.id} status={alert.status} />}
        noteForm={<NoteForm id={alert.id} />}
      />
    </>
  );
}
