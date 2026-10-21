import type { EventView } from "@/lib/events/filters";
import { formatTime } from "@/lib/format";
import { EventTypeBadge, SourceBadge } from "./EventBadges";
import { PathText } from "./PathText";

const fresh = "animate-[flash_2.4s_ease-out]"; // new rows glow teal for a moment (off with reduced motion)

function Where({ e }: { e: EventView }) {
  if (!e.path) return <span className="text-muted">—</span>;
  return (
    <span className="font-mono text-xs">
      {e.method && <span className="whitespace-nowrap text-muted">{e.method} </span>}
      <PathText path={e.path} />
      {e.statusCode && <span className="whitespace-nowrap text-muted"> · {e.statusCode}</span>}
    </span>
  );
}

/** Events as a table on wider screens and as cards on phones. Only one of the two is ever displayed. */
export function EventList({
  events,
  freshIds,
  caption,
}: {
  events: EventView[];
  freshIds?: ReadonlySet<number>;
  caption: string;
}) {
  return (
    <>
      <table className="hidden w-full text-left text-sm md:table">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-line text-xs text-muted">
            <th scope="col" className="py-2 pr-4 font-normal">
              Time (IST)
            </th>
            <th scope="col" className="py-2 pr-4 font-normal">
              Source
            </th>
            <th scope="col" className="py-2 pr-4 font-normal">
              Event
            </th>
            <th scope="col" className="py-2 pr-4 font-normal">
              Who
            </th>
            <th scope="col" className="py-2 pr-4 font-normal">
              IP
            </th>
            <th scope="col" className="py-2 font-normal">
              Where
            </th>
          </tr>
        </thead>
        <tbody>
          {events.map((e) => (
            <tr
              key={e.id}
              className={`border-b border-line/60 align-top ${freshIds?.has(e.id) ? fresh : ""}`}
            >
              <td className="py-2.5 pr-4 font-mono text-xs whitespace-nowrap text-muted">
                <time dateTime={e.occurredAt}>{formatTime(e.occurredAt)}</time>
              </td>
              <td className="py-2.5 pr-4">
                <SourceBadge source={e.source} />
              </td>
              <td className="py-2.5 pr-4">
                <EventTypeBadge type={e.type} />
              </td>
              <td className="py-2.5 pr-4 font-mono text-xs">
                {e.actor ?? <span className="text-muted">—</span>}
              </td>
              <td className="py-2.5 pr-4 font-mono text-xs whitespace-nowrap">
                {e.ip ?? <span className="text-muted">—</span>}
                {e.country && <span className="text-muted"> {e.country}</span>}
              </td>
              <td className="py-2.5">
                <Where e={e} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <ul className="space-y-3 md:hidden" aria-label={caption}>
        {events.map((e) => (
          <li
            key={e.id}
            className={`rounded-lg border border-line bg-ground/40 p-3 text-sm ${freshIds?.has(e.id) ? fresh : ""}`}
          >
            <div className="flex items-center justify-between gap-2">
              <EventTypeBadge type={e.type} />
              <SourceBadge source={e.source} />
            </div>
            <p className="mt-1.5 font-mono text-xs text-muted">
              <time dateTime={e.occurredAt}>{formatTime(e.occurredAt)}</time>
              {e.ip && ` · ${e.ip}`}
              {e.country && ` ${e.country}`}
            </p>
            {e.actor && <p className="mt-1 font-mono text-xs">{e.actor}</p>}
            {e.path && (
              <p className="mt-1">
                <Where e={e} />
              </p>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
