"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { FormError } from "@/components/ui/FormError";
import { setAlertStatus } from "@/lib/api/alerts";
import { errorMessage } from "@/lib/api/client";
import { nextActions } from "@/lib/alerts/status";
import type { AlertStatus } from "@/lib/alerts/types";

/** The status buttons (Acknowledge / Resolve / Reopen). The server checks every move again. */
export function AlertActions({ id, status }: { id: number; status: AlertStatus }) {
  const router = useRouter();
  const [busy, setBusy] = useState<AlertStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Change status">
        {nextActions(status).map((action, i) => (
          <Button
            key={action.to}
            variant={i === 0 ? "primary" : "ghost"}
            busy={busy === action.to}
            disabled={busy !== null}
            onClick={async () => {
              setBusy(action.to);
              setError(null);
              try {
                await setAlertStatus(id, action.to);
                router.refresh();
              } catch (err) {
                setError(errorMessage(err));
              } finally {
                setBusy(null);
              }
            }}
          >
            {action.label}
          </Button>
        ))}
      </div>
      <FormError message={error} />
    </div>
  );
}
