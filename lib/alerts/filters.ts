import { z } from "zod";
import { SOURCES } from "@/lib/events/types";
import { SEVERITIES } from "./types";

// Alert list filters, in the URL like the events filters. "active" (the default) = open + acknowledged.
export const ALERT_VIEWS = ["active", "open", "acknowledged", "resolved", "all"] as const;
export type AlertView = (typeof ALERT_VIEWS)[number];
export const ALERT_PAGE_SIZE = 20;

const one = (v: unknown) => (Array.isArray(v) ? v[0] : v);

export const alertFiltersSchema = z.object({
  view: z.preprocess(one, z.enum(ALERT_VIEWS).catch("active")).default("active"),
  severity: z.preprocess(one, z.enum(SEVERITIES).optional().catch(undefined)),
  source: z.preprocess(one, z.enum(SOURCES).optional().catch(undefined)),
  page: z.preprocess(one, z.coerce.number().int().min(1).max(10_000).catch(1)).default(1),
});
export type AlertFilters = z.infer<typeof alertFiltersSchema>;

export function parseAlertFilters(params: Record<string, string | string[] | undefined>): AlertFilters {
  return alertFiltersSchema.parse(params);
}

export function alertFiltersToQuery(f: Partial<AlertFilters>): string {
  const p = new URLSearchParams();
  if (f.view && f.view !== "active") p.set("view", f.view);
  if (f.severity) p.set("severity", f.severity);
  if (f.source) p.set("source", f.source);
  if (f.page && f.page > 1) p.set("page", String(f.page));
  const text = p.toString();
  return text ? `?${text}` : "";
}
