import { z } from "zod";
import { ALERT_STATUSES } from "@/lib/alerts/types";

export const statusBody = z.object({ status: z.enum(ALERT_STATUSES) });
export type StatusBody = z.infer<typeof statusBody>;

export const noteBody = z.object({ note: z.string().trim().min(1, "Write a note first").max(2000) });
export type NoteBody = z.infer<typeof noteBody>;

/** Alert ids in the URL: a positive whole number, else 404. */
export const alertId = z.coerce.number().int().positive().max(Number.MAX_SAFE_INTEGER);
