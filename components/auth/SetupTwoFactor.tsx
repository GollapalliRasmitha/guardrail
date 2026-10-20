"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { Button, buttonClass } from "@/components/ui/Button";
import { FormError } from "@/components/ui/FormError";
import { confirmSetup, startSetup } from "@/lib/api/auth";
import { ApiError, errorMessage } from "@/lib/api/client";
import type { SetupStartResponse } from "@/lib/validation/auth";
import { CodeField } from "./CodeField";

export function SetupTwoFactor() {
  const router = useRouter();
  const [setup, setSetup] = useState<SetupStartResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    startSetup()
      .then((data) => !cancelled && setSetup(data))
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) router.replace("/signin");
        else setLoadError(errorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, [attempt, router]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await confirmSetup({ code });
      router.replace("/dashboard");
      router.refresh();
    } catch (err) {
      setCode("");
      if (err instanceof ApiError && (err.code === "no_pending_signin" || err.code === "rate_limited")) {
        router.replace("/signin");
      }
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  if (loadError) {
    return (
      <div className="space-y-4">
        <FormError message={loadError} />
        <button
          type="button"
          className={buttonClass("ghost", "w-full")}
          onClick={() => {
            setLoadError(null);
            setAttempt((n) => n + 1);
          }}
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <ol className="list-decimal space-y-1 pl-5 text-sm text-muted">
        <li>Open an authenticator app (Google Authenticator, Microsoft Authenticator, 1Password…).</li>
        <li>Scan this QR code, or type the key below.</li>
        <li>Enter the 6-digit code it shows.</li>
      </ol>

      <div className="grid place-items-center rounded-xl bg-white p-3" aria-busy={!setup}>
        {setup ? (
          // A data: URL made on our server; next/image adds nothing for it.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={setup.qrDataUrl}
            width={200}
            height={200}
            alt="QR code to add GuardRail to your authenticator app"
          />
        ) : (
          <div className="size-[200px] animate-pulse rounded bg-slate-200" aria-label="Loading QR code" />
        )}
      </div>

      {setup && (
        <div>
          <p className="eyebrow">Or type this key</p>
          <p className="mt-1 font-mono text-sm break-all text-text select-all" data-testid="totp-key">
            {setup.secret.match(/.{1,4}/g)?.join(" ")}
          </p>
          <p className="mt-1 text-xs text-muted">Account: {setup.account} · Time-based · 6 digits</p>
        </div>
      )}

      <CodeField
        value={code}
        onChange={setCode}
        invalid={!!error}
        describedBy={error ? "setup-error" : undefined}
      />
      <FormError id="setup-error" message={error} />
      <Button type="submit" busy={busy} disabled={!setup} className="w-full">
        Turn on 2FA
      </Button>
    </form>
  );
}
