"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { FormError } from "@/components/ui/FormError";
import { signOutEverywhere } from "@/lib/api/auth";
import { errorMessage } from "@/lib/api/client";

export function SignOutEverywhere() {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!confirming) {
    return (
      <Button variant="danger" onClick={() => setConfirming(true)}>
        Sign out everywhere
      </Button>
    );
  }
  return (
    <div className="space-y-3" role="group" aria-label="Confirm sign out everywhere">
      <p className="text-sm">Sign out every device now?</p>
      <FormError message={error} />
      <div className="flex flex-wrap gap-3">
        <Button
          variant="danger"
          busy={busy}
          autoFocus
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              await signOutEverywhere();
              router.replace("/signin");
              router.refresh();
            } catch (err) {
              setError(errorMessage(err));
              setBusy(false);
            }
          }}
        >
          Yes, sign out everywhere
        </Button>
        <Button variant="ghost" onClick={() => setConfirming(false)} disabled={busy}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
