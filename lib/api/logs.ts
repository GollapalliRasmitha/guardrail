import type { SourceId } from "@/lib/events/types";
import type { AnalyzeResponse } from "@/lib/validation/logs";
import { apiFetch } from "./client";

export const analyzeLogFile = (file: Blob, source: SourceId) =>
  apiFetch<AnalyzeResponse>(`/api/logs/analyze?source=${source}`, { method: "POST", text: file });
