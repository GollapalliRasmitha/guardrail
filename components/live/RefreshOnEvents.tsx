"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useLive } from "./LiveProvider";

const DELAY_MS = 2_500;

/**
 * Keeps server-rendered pages (alerts, counts) fresh: when live events arrive, re-render the page from the server
 * a moment later. Detection runs just after each event is stored, so waiting ~2.5 s lets the alert exist first.
 * Bursts of events cause one refresh, not one per event.
 */
export function RefreshOnEvents() {
  const router = useRouter();
  const { subscribe } = useLive();

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const stop = subscribe(() => {
      if (timer) return; // a refresh is already on its way
      timer = setTimeout(() => {
        timer = null;
        router.refresh();
      }, DELAY_MS);
    });
    return () => {
      stop();
      if (timer) clearTimeout(timer);
    };
  }, [subscribe, router]);

  return null;
}
