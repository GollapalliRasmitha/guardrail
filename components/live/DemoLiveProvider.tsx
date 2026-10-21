"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { LiveState } from "@/components/ui/LiveDot";
import { demoLiveEvent } from "@/lib/demo/live";
import { seeded } from "@/lib/demo/random";
import { LiveContext, type Listener } from "./LiveProvider";

/**
 * The demo's stand-in for LiveProvider: same context, so every live list works unchanged, but the events are
 * made up in the browser every few seconds. No network, no database. Pauses while the tab is hidden.
 */
export function DemoLiveProvider({
  initialCursor,
  children,
}: {
  initialCursor: number;
  children: ReactNode;
}) {
  const [state, setState] = useState<LiveState>("live");
  const listeners = useRef(new Set<Listener>());

  useEffect(() => {
    const rand = seeded(Date.now() % 100_000);
    let id = initialCursor;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const tick = () => {
      const event = demoLiveEvent(rand, ++id, new Date());
      listeners.current.forEach((listener) => listener([event]));
      timer = setTimeout(tick, rand.int(3_000, 7_000));
    };
    const onVisibility = () => {
      if (timer) clearTimeout(timer);
      timer = null;
      if (document.visibilityState === "hidden") setState("paused");
      else {
        setState("live");
        timer = setTimeout(tick, 2_000);
      }
    };
    timer = setTimeout(tick, 2_000);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      if (timer) clearTimeout(timer);
    };
  }, [initialCursor]);

  const subscribe = useCallback((listener: Listener) => {
    listeners.current.add(listener);
    return () => void listeners.current.delete(listener);
  }, []);
  const value = useMemo(() => ({ state, subscribe }), [state, subscribe]);
  return <LiveContext value={value}>{children}</LiveContext>;
}
