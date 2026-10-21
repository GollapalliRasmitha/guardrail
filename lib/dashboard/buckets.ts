import type { SourceId } from "@/lib/events/types";

// Pure helpers for the "events over time" chart (no database, so they're unit-tested).

const HOUR = 3_600_000;
/** India is UTC+5:30 all year (no daylight saving), so a fixed offset is exact. */
export const IST_OFFSET_MS = 5.5 * HOUR;

export type HourBucket = { start: Date; homehaat: number; oppora: number; total: number };

/**
 * 24 hourly buckets, the last one being the current hour. Hours with no events are zeros, not missing.
 * `offsetMs` shifts the hour boundaries to a time zone (IST: hours start at :30 UTC, so they read "15:00" in India).
 */
export function hourlyBuckets(
  rows: { hour: Date; source: SourceId; n: number }[],
  now: Date,
  offsetMs = 0,
): HourBucket[] {
  const currentHour = firstBucketStart(now, offsetMs).getTime() + 23 * HOUR;
  const buckets: HourBucket[] = Array.from({ length: 24 }, (_, i) => ({
    start: new Date(currentHour - (23 - i) * HOUR),
    homehaat: 0,
    oppora: 0,
    total: 0,
  }));
  for (const row of rows) {
    const index = 23 - Math.round((currentHour - row.hour.getTime()) / HOUR);
    const bucket = buckets[index];
    if (!bucket) continue; // outside the 24 hours
    bucket[row.source] += row.n;
    bucket.total += row.n;
  }
  return buckets;
}

/** The start of the oldest of the 24 bars: the top of the hour, 23 hours before the current one. */
export function firstBucketStart(now: Date, offsetMs = 0): Date {
  return new Date(Math.floor((now.getTime() + offsetMs) / HOUR) * HOUR - offsetMs - 23 * HOUR);
}

/** The top of the y axis: the smallest of 4, 8, 20, 40, 80, 200, 400… that fits (four even steps). */
export function niceMax(value: number): number {
  for (let magnitude = 1; ; magnitude *= 10) {
    for (const step of [4, 8, 20]) if (value <= step * magnitude) return step * magnitude;
  }
}
