import { NextResponse } from "next/server";
import { guardChange } from "@/lib/auth/api-guard";
import { jsonError } from "@/lib/http/request";
import { analyzeLog } from "@/lib/logs/analyze";
import { logSource, MAX_LOG_BYTES, type AnalyzeResponse } from "@/lib/validation/logs";

/**
 * Analyse an uploaded log file with the detection rules. The body is the file itself (plain text), and
 * `?source=homehaat|oppora` says which site it came from. Nothing from the file is stored: the analysis runs in
 * memory and the answer is the only copy.
 */
export async function POST(request: Request) {
  const refused = await guardChange(request);
  if (refused) return refused;

  const source = logSource.safeParse(new URL(request.url).searchParams.get("source"));
  if (!source.success) return jsonError(400, "invalid", "Choose which site the log is from.");

  // Size: the header first (cheap), then the real body, because the header can lie.
  const tooBig = () =>
    jsonError(413, "too_large", "The file is bigger than 4 MB. Upload a smaller part of it.");
  if (Number(request.headers.get("content-length") ?? 0) > MAX_LOG_BYTES) return tooBig();
  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.byteLength > MAX_LOG_BYTES) return tooBig();
  if (bytes.byteLength === 0) return jsonError(400, "empty", "The file is empty.");
  if (bytes[0] === 0x1f && bytes[1] === 0x8b) {
    return jsonError(400, "compressed", "This is a .gz file. Unzip it first, then upload the .log inside.");
  }
  if (bytes.subarray(0, 4096).includes(0))
    return jsonError(400, "binary", "This doesn't look like a text log file.");

  const result = analyzeLog(new TextDecoder().decode(bytes), source.data);
  if (result.formats.access + result.formats.auth === 0) {
    return jsonError(
      400,
      "unknown_format",
      "No line looked like an nginx / Apache access log or a Linux auth.log. Check the file and try again.",
    );
  }
  return NextResponse.json(result as unknown as AnalyzeResponse); // Dates become ISO strings in JSON
}
