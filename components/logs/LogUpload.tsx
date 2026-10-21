"use client";

import { FileUp, FlaskConical } from "lucide-react";
import { useRef, useState, type DragEvent, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { FormError } from "@/components/ui/FormError";
import { errorMessage } from "@/lib/api/client";
import { analyzeLogFile } from "@/lib/api/logs";
import { SOURCE_INFO, SOURCES, type SourceId } from "@/lib/events/types";
import { formatCount } from "@/lib/format";
import { MAX_LOG_BYTES, type AnalyzeResponse } from "@/lib/validation/logs";
import { LogResults } from "./LogResults";

const SAMPLES = [
  { file: "access.log", label: "Sample access log" },
  { file: "auth.log", label: "Sample auth.log" },
] as const;

/** Choose a site and a log file (or drop one, or use a sample); the analysis appears below. */
export function LogUpload() {
  const input = useRef<HTMLInputElement>(null);
  const [source, setSource] = useState<SourceId>("homehaat");
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ name: string; data: AnalyzeResponse } | null>(null);

  function choose(next: File | null) {
    setError(null);
    if (next && next.size > MAX_LOG_BYTES) {
      setFile(null);
      setError(`"${next.name}" is bigger than 4 MB. Upload a smaller part of it.`);
      return;
    }
    setFile(next);
  }

  async function analyze(blob: Blob, name: string) {
    setBusy(true);
    setError(null);
    try {
      setResult({ name, data: await analyzeLogFile(blob, source) });
    } catch (err) {
      setResult(null);
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!file) return setError("Choose a log file first.");
    await analyze(file, file.name);
  }

  async function trySample(name: string) {
    const response = await fetch(`/samples/${name}`).catch(() => null);
    if (!response?.ok) return setError("Couldn't load the sample. Try again.");
    await analyze(await response.blob(), `${name} (sample)`);
  }

  function onDrop(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    choose(event.dataTransfer.files[0] ?? null);
  }

  return (
    <div className="space-y-6">
      <form onSubmit={submit} className="space-y-5 rounded-xl border border-line bg-panel p-5">
        <div className="grid gap-5 md:grid-cols-[14rem_1fr]">
          <div>
            <label htmlFor="log-source" className="mb-1.5 block text-sm font-medium">
              Which site is it from?
            </label>
            <select
              id="log-source"
              className="input min-h-11"
              value={source}
              onChange={(e) => setSource(e.target.value as SourceId)}
            >
              {SOURCES.map((s) => (
                <option key={s} value={s}>
                  {SOURCE_INFO[s].name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <span id="log-file-label" className="mb-1.5 block text-sm font-medium">
              Log file
            </span>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              className={`flex flex-col items-start gap-3 rounded-lg border border-dashed p-4 sm:flex-row sm:items-center ${
                dragging ? "border-accent bg-accent/5" : "border-line"
              }`}
            >
              <input
                ref={input}
                id="log-file"
                type="file"
                accept=".log,.txt,text/plain"
                aria-labelledby="log-file-label"
                aria-describedby="log-file-help"
                className="sr-only"
                onChange={(e) => choose(e.target.files?.[0] ?? null)}
              />
              <Button type="button" variant="ghost" onClick={() => input.current?.click()}>
                <FileUp className="size-4" aria-hidden /> Choose a file
              </Button>
              <p className="min-w-0 text-sm break-words text-muted" aria-live="polite">
                {file ? (
                  <>
                    <span className="font-mono text-text">{file.name}</span> ·{" "}
                    {formatCount(Math.ceil(file.size / 1024))} KB
                  </>
                ) : (
                  "or drop it here"
                )}
              </p>
            </div>
            <p id="log-file-help" className="mt-1.5 text-xs text-muted">
              nginx or Apache access log, or a Linux auth.log (sshd). Up to 4 MB. Unzip .gz files first. Times
              without a time zone (classic auth.log) are read as UTC.
            </p>
          </div>
        </div>

        <FormError message={error} />

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" busy={busy} disabled={!file}>
            Analyse
          </Button>
          <span className="text-sm text-muted">No log at hand?</span>
          {SAMPLES.map((s) => (
            <Button
              key={s.file}
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={() => trySample(s.file)}
            >
              <FlaskConical className="size-4" aria-hidden /> {s.label}
            </Button>
          ))}
        </div>
        <p className="text-xs text-muted">
          The file is analysed in memory and never stored: leave this page and the results are gone.
        </p>
      </form>

      {result && <LogResults name={result.name} result={result.data} />}
    </div>
  );
}
