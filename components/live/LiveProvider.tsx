"use client";

import { useRouter } from "next/navigation";
import { createContext, use, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { LiveState } from "@/components/ui/LiveDot";
import { eventsAfter } from "@/lib/api/events";
import { ApiError } from "@/lib/api/client";
import type { EventView } from "@/lib/events/filters";

export type Listener = (events: EventView[]) => void;
export type LiveContextValue = { state: LiveState; subscribe: (listener: Listener) => () => void };

export const LiveContext = createContext<LiveContextValue | null>(null);

const POLL_MS = 5_000;
const SHOW_RECONNECTING_AFTER_MS = 3_000; // the stream closes every ~50 s on purpose; don't flash "Reconnecting"
const FAILURES_BEFORE_POLLING = 3;

/**
 * ONE live connection for the whole dashboard, shared by the header dot, the Overview feed and the Events list.
 * - Server-Sent Events first (EventSource reconnects by itself and resumes from Last-Event-ID).
 * - If the stream keeps failing, fall back to asking /api/events?after= every 5 seconds.
 * - While the tab is hidden, disconnect (saves battery and database time); catch up when it's visible again.
 */
export function LiveProvider({ initialCursor, children }: { initialCursor: number; children: ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<LiveState>("connecting");
  const listeners = useRef(new Set<Listener>());
  const cursor = useRef(initialCursor);

  useEffect(() => {
    let source: EventSource | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let slowTimer: ReturnType<typeof setTimeout> | null = null;
    let failures = 0;

    const deliver = (events: EventView[]) => {
      if (events.length === 0) return;
      cursor.current = Math.max(cursor.current, events[events.length - 1]!.id);
      listeners.current.forEach((listener) => listener(events));
    };

    const stop = () => {
      source?.close();
      source = null;
      if (pollTimer) clearInterval(pollTimer);
      if (slowTimer) clearTimeout(slowTimer);
      pollTimer = slowTimer = null;
    };

    const poll = async () => {
      try {
        const { events } = await eventsAfter(cursor.current);
        deliver(events);
        setState("polling");
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) router.replace("/signin");
        else setState("offline");
      }
    };

    const startPolling = () => {
      stop();
      void poll();
      pollTimer = setInterval(poll, POLL_MS);
    };

    const startStream = () => {
      stop();
      source = new EventSource(`/api/stream?after=${cursor.current}`);
      source.onopen = () => {
        failures = 0;
        if (slowTimer) clearTimeout(slowTimer);
        slowTimer = null;
        setState("live");
      };
      source.addEventListener("events", (message) => {
        deliver(JSON.parse((message as MessageEvent<string>).data) as EventView[]);
      });
      source.onerror = () => {
        // CLOSED = the server refused (e.g. signed out); CONNECTING = normal reconnect after our 50 s close.
        if (source?.readyState === EventSource.CLOSED || ++failures >= FAILURES_BEFORE_POLLING) {
          startPolling();
          return;
        }
        slowTimer ??= setTimeout(() => setState("connecting"), SHOW_RECONNECTING_AFTER_MS);
      };
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        stop();
        setState("paused");
      } else {
        failures = 0;
        startStream();
      }
    };

    startStream();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      stop();
    };
  }, [router]);

  const subscribe = useCallback((listener: Listener) => {
    listeners.current.add(listener);
    return () => void listeners.current.delete(listener);
  }, []);
  const value = useMemo(() => ({ state, subscribe }), [state, subscribe]);
  return <LiveContext value={value}>{children}</LiveContext>;
}

export function useLive(): LiveContextValue {
  const value = use(LiveContext);
  if (!value) throw new Error("useLive must be used inside <LiveProvider>");
  return value;
}
