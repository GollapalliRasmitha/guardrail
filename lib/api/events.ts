import type { EventsAfterResponse } from "@/app/api/events/route";
import { apiFetch } from "./client";

/** Events newer than `cursor`: the live feed's fallback when the stream can't connect. */
export const eventsAfter = (cursor: number) => apiFetch<EventsAfterResponse>(`/api/events?after=${cursor}`);
