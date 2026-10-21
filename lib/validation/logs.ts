import { z } from "zod";
import { SOURCES } from "@/lib/events/types";
import type { LogAnalysis, LogFinding } from "@/lib/logs/analyze";

/** 4 MB: Vercel's free plan refuses request bodies over 4.5 MB, so anything bigger would fail there anyway. */
export const MAX_LOG_BYTES = 4 * 1024 * 1024;

export const logSource = z.enum(SOURCES);

type Dated<T, K extends keyof T> = Omit<T, K> & { [P in K]: T[P] extends Date ? string : string | null };

/** What POST /api/logs/analyze answers (dates as ISO strings, the way JSON carries them). */
export type LogFindingJson = Dated<LogFinding, "firstSeen" | "lastSeen">;
export type AnalyzeResponse = Omit<Dated<LogAnalysis, "firstAt" | "lastAt">, "findings"> & {
  findings: LogFindingJson[];
};
