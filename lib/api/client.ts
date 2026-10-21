import type { ApiErrorBody } from "@/lib/http/request";

/** Every failed API call becomes one of these, with a message that's safe to show on screen. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly retryAfterSec?: number,
  ) {
    super(message);
  }
}

function friendly(status: number): string {
  if (status === 0) return "Can't reach GuardRail. Check your connection and try again.";
  if (status === 429) return "Too many tries. Wait a few minutes and try again.";
  if (status >= 500) return "Something went wrong on the server. Try again in a moment.";
  return "That didn't work. Try again.";
}

/** The ONLY place the frontend calls fetch. Typed in and out; every failure is an ApiError. */
export async function apiFetch<T>(
  path: `/api/${string}`,
  init: { method?: "GET" | "POST"; body?: unknown; text?: Blob } = {},
): Promise<T> {
  let response: Response;
  // `text` sends a file as it is (plain text); `body` sends JSON.
  const headers = init.text
    ? { "Content-Type": "text/plain" }
    : init.body === undefined
      ? undefined
      : { "Content-Type": "application/json" };
  try {
    response = await fetch(path, {
      method: init.method ?? "GET",
      headers,
      body: init.text ?? (init.body === undefined ? undefined : JSON.stringify(init.body)),
      credentials: "same-origin",
      cache: "no-store",
    });
  } catch {
    throw new ApiError(0, "network", friendly(0));
  }
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = (data as Partial<ApiErrorBody> | null)?.error;
    throw new ApiError(
      response.status,
      error?.code ?? "unknown",
      error?.message ?? friendly(response.status),
      error?.retryAfterSec,
    );
  }
  return data as T;
}

export function errorMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : friendly(500);
}
