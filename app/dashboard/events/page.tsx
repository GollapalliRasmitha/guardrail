import { Activity, SearchX } from "lucide-react";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { EventFilterBar } from "@/components/events/EventFilterBar";
import { LiveEventList } from "@/components/events/LiveEventList";
import { PageHeader } from "@/components/shell/AppShell";
import { buttonClass } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { Panel } from "@/components/ui/Panel";
import { requireActiveSession } from "@/lib/auth/guards";
import { filtersToQuery, parseEventFilters } from "@/lib/events/filters";
import { listEvents } from "@/lib/events/query";

export const metadata: Metadata = { title: "Events" };

export default async function EventsPage({ searchParams }: PageProps<"/dashboard/events">) {
  await requireActiveSession();
  const filters = parseEventFilters(await searchParams);
  const result = await listEvents(filters);
  const filtered = Boolean(filters.source || filters.type || filters.q);

  const empty = filtered ? (
    <EmptyState
      icon={<SearchX className="size-6" />}
      title="No events match"
      action={
        <Link href="/dashboard/events" className={buttonClass("ghost")}>
          Clear filters
        </Link>
      }
    >
      Nothing matches these filters yet. New matching events will appear here live.
    </EmptyState>
  ) : (
    <EmptyState icon={<Activity className="size-6" />} title="No events yet">
      When HomeHaat and Oppora send signed events, they appear here the moment they arrive. To try it locally,
      run <code className="font-mono text-text">npm run send-test-event</code>.
    </EmptyState>
  );

  return (
    <>
      <PageHeader eyebrow="Telemetry" title="Events" />
      <EventFilterBar filters={filters} />
      <Panel>
        {/* key: a new filter or page starts a fresh list instead of mixing old live rows in. */}
        <LiveEventList
          key={filtersToQuery(filters)}
          initial={result.events}
          filters={filters}
          live={filters.page === 1}
          max={100}
          caption="Security events, newest first"
          empty={empty}
        />
        <Pagination
          page={result.page}
          pages={result.pages}
          total={result.total}
          hrefFor={(page) => `/dashboard/events${filtersToQuery({ ...filters, page })}` as Route}
        />
      </Panel>
    </>
  );
}
