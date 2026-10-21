import type { StatusResponse } from "@/app/api/alerts/[id]/status/route";
import type { AlertStatus } from "@/lib/alerts/types";
import type { OkResponse } from "@/lib/validation/auth";
import { apiFetch } from "./client";

export const setAlertStatus = (id: number, status: AlertStatus) =>
  apiFetch<StatusResponse>(`/api/alerts/${id}/status`, { method: "POST", body: { status } });

export const addAlertNote = (id: number, note: string) =>
  apiFetch<OkResponse>(`/api/alerts/${id}/notes`, { method: "POST", body: { note } });
