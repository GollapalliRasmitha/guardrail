import { NextResponse } from "next/server";
import { env } from "@/lib/env";

/** Every API error has the same shape, so the frontend can show `error.message` and branch on `error.code`. */
export type ApiErrorBody = { error: { code: string; message: string; retryAfterSec?: number } };

export function jsonError(
  status: number,
  code: string,
  message: string,
  extra: { retryAfterSec?: number } = {},
) {
  const headers = extra.retryAfterSec ? { "Retry-After": String(extra.retryAfterSec) } : undefined;
  return NextResponse.json<ApiErrorBody>({ error: { code, message, ...extra } }, { status, headers });
}

/**
 * CSRF protection for every request that changes something. Browsers always send `Origin` on POST, and a page on
 * another site can't fake it. Together with SameSite cookies this stops other sites submitting forms as me.
 */
export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  return origin !== null && origin === new URL(env().APP_URL).origin;
}

/**
 * The visitor's IP. On Vercel, `x-real-ip` is set by Vercel's edge and can't be faked by the visitor. Locally there
 * is no proxy in front, so every request is "local" (headers could be faked there, but only by me).
 */
export function clientIp(request: Request): string {
  if (process.env.VERCEL) return request.headers.get("x-real-ip") ?? "unknown";
  return "local";
}

/** Read a JSON body safely: anything that isn't JSON becomes null instead of throwing. */
export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
