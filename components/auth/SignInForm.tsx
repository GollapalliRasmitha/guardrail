"use client";

import { Eye, EyeOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { FormError } from "@/components/ui/FormError";
import { signIn, verifyCode } from "@/lib/api/auth";
import { ApiError, errorMessage } from "@/lib/api/client";
import { CodeField } from "./CodeField";

type Step = "password" | "code";

export function SignInForm({ startAt }: { startAt: Step }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(startAt);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submitPassword(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { next } = await signIn({ email, password });
      setPassword(""); // don't keep it in memory longer than needed
      if (next === "setup-2fa") router.replace("/setup-2fa");
      else setStep("code");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function submitCode(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await verifyCode({ code });
      router.replace("/dashboard");
      router.refresh();
    } catch (err) {
      setCode("");
      // The half-finished sign-in expired or was locked: back to the password step.
      if (err instanceof ApiError && (err.code === "no_pending_signin" || err.code === "rate_limited")) {
        setStep("password");
      }
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  if (step === "code") {
    return (
      <form onSubmit={submitCode} className="space-y-5" noValidate>
        <p className="text-sm text-muted">
          <span className="font-mono text-xs text-accent">Step 2 of 2 · </span>
          Open your authenticator app and type the code for GuardRail.
        </p>
        <CodeField
          value={code}
          onChange={setCode}
          invalid={!!error}
          describedBy={error ? "signin-error" : undefined}
        />
        <FormError id="signin-error" message={error} />
        <Button type="submit" busy={busy} className="w-full">
          Verify and sign in
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={submitPassword} className="space-y-5" noValidate>
      <div>
        <label htmlFor="email" className="mb-1.5 block text-sm font-medium">
          Email
        </label>
        <input
          id="email"
          type="email"
          className="input"
          autoComplete="username"
          required
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={!!error || undefined}
          aria-describedby={error ? "signin-error" : undefined}
        />
      </div>
      <div>
        <label htmlFor="password" className="mb-1.5 block text-sm font-medium">
          Password
        </label>
        <div className="relative">
          <input
            id="password"
            type={showPassword ? "text" : "password"}
            className="input pr-12"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={!!error || undefined}
            aria-describedby={error ? "signin-error" : undefined}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-lg text-muted hover:text-text"
            aria-label={showPassword ? "Hide password" : "Show password"}
            aria-pressed={showPassword}
          >
            {showPassword ? (
              <EyeOff className="size-4" aria-hidden />
            ) : (
              <Eye className="size-4" aria-hidden />
            )}
          </button>
        </div>
      </div>
      <FormError id="signin-error" message={error} />
      <Button type="submit" busy={busy} className="w-full" disabled={!email || !password}>
        Continue
      </Button>
    </form>
  );
}
