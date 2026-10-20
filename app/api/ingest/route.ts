import { NextResponse } from "next/server";
import { jsonError } from "@/lib/http/request";
import { parseBatch } from "@/lib/ingest/schema";
import { verifySignature } from "@/lib/ingest/signature";
import {
  claimNonce,
  INGEST_RATE_PER_MINUTE,
  insertEvents,
  isSource,
  pruneNonces,
  recentRequestCount,
  secretFor,
} from "@/lib/ingest/store";

const MAX_BODY_BYTES = 64 * 1024;

export type IngestResponse = { accepted: number; rejected: { index: number; reason: string }[] };

/**
 * HomeHaat and Oppora send security events here, signed with their own secret (see lib/ingest/signature.ts).
 * Order matters: cheap checks first, and nothing is written to the database until the signature is proven.
 * Every auth failure gets the same answer, so an attacker learns nothing about which check failed.
 */
export async function POST(request: Request) {
  const unauthorized = () => jsonError(401, "unauthorized", "Unauthorized.");

  // 1. Which source? Unknown names are refused before anything else.
  const source = request.headers.get("x-guardrail-source");
  if (!isSource(source)) return unauthorized();

  // 2. Size limit, checked on the declared length AND the real body (the header can lie).
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > MAX_BODY_BYTES) return jsonError(413, "too_large", "Body is larger than 64 KB.");
  const rawBody = await request.text();
  if (Buffer.byteLength(rawBody) > MAX_BODY_BYTES)
    return jsonError(413, "too_large", "Body is larger than 64 KB.");

  // 3. Signature + timestamp window, on the exact raw bytes (before any JSON parsing).
  const verdict = verifySignature({
    secret: secretFor(source),
    timestampHeader: request.headers.get("x-guardrail-timestamp"),
    nonceHeader: request.headers.get("x-guardrail-nonce"),
    signatureHeader: request.headers.get("x-guardrail-signature"),
    rawBody,
    nowSec: Math.floor(Date.now() / 1000),
  });
  if (!verdict.ok) return unauthorized();

  // 4. Rate limit per source (only reachable with a valid signature, so outsiders can't use up the budget).
  if ((await recentRequestCount(source)) >= INGEST_RATE_PER_MINUTE) {
    return jsonError(429, "rate_limited", "Too many requests.", { retryAfterSec: 60 });
  }

  // 5. Replay protection: each nonce works once.
  if (!(await claimNonce(source, request.headers.get("x-guardrail-nonce")!))) return unauthorized();

  // 6. Validate and clean the events (masking, allow-listed fields), then store.
  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return jsonError(400, "invalid_json", "Body is not JSON.");
  }
  const batch = parseBatch(body, new Date());
  if (!batch.ok) return jsonError(400, "invalid_batch", batch.reason);

  await insertEvents(source, batch.accepted);
  if (Math.random() < 0.05) await pruneNonces(); // cheap housekeeping on ~1 in 20 requests

  return NextResponse.json<IngestResponse>(
    { accepted: batch.accepted.length, rejected: batch.rejected },
    { status: 202 },
  );
}
