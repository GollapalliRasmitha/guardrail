import { getCurrentSession } from "@/lib/auth/session";
import { eventsAfter, latestEventId } from "@/lib/events/query";
import { jsonError } from "@/lib/http/request";
import { parseCursor, sseComment, sseMessage } from "@/lib/live/sse";

// The live feed, as Server-Sent Events.
//
// Serverless functions don't share memory, so there's no in-process "pub/sub" to listen to. Instead each open
// stream asks Postgres every 2 seconds "anything with id > the last one I sent?" (one indexed query), and closes
// itself after ~50 seconds, well under Vercel Hobby's 300-second limit. The browser's EventSource reconnects on its
// own and sends Last-Event-ID, so nothing is missed or sent twice.

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const POLL_MS = 2_000;
const HEARTBEAT_MS = 15_000;
const LIFETIME_MS = 50_000;

const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => (clearTimeout(timer), resolve()), { once: true });
  });

export async function GET(request: Request) {
  const current = await getCurrentSession();
  if (!current || current.state !== "active") return jsonError(401, "signed_out", "Please sign in.");

  const url = new URL(request.url);
  let cursor =
    parseCursor(request.headers.get("last-event-id"), url.searchParams.get("after")) ??
    (await latestEventId());

  const encoder = new TextEncoder();
  const signal = request.signal; // aborted when the browser goes away

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (text: string) => {
        if (!signal.aborted) controller.enqueue(encoder.encode(text)); // never write to a closed connection
      };
      send("retry: 1000\n\n"); // reconnect 1 second after we close
      send(sseComment("connected"));

      const started = Date.now();
      let lastBeat = started;
      try {
        while (!signal.aborted && Date.now() - started < LIFETIME_MS) {
          const events = await eventsAfter(cursor);
          if (events.length > 0) {
            cursor = events[events.length - 1]!.id;
            send(sseMessage({ id: cursor, event: "events", data: events }));
          } else if (Date.now() - lastBeat > HEARTBEAT_MS) {
            send(sseComment("ping"));
            lastBeat = Date.now();
          }
          await sleep(POLL_MS, signal);
        }
      } catch {
        // Database hiccup: just end this stream; the browser reconnects and resumes from Last-Event-ID.
      } finally {
        try {
          controller.close();
        } catch {
          // already closed because the browser left
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // tell proxies not to buffer the stream
    },
  });
}
