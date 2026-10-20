"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { signOut } from "@/lib/api/auth";

export function SignOutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        // Even if the request fails, leave the dashboard: the server-side session is checked on every page.
        await signOut().catch(() => undefined);
        router.replace("/signin");
        router.refresh();
      }}
      className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-sm text-muted transition hover:bg-panel-2 hover:text-text disabled:opacity-60"
    >
      <LogOut className="size-4.5" aria-hidden />
      {busy ? "Signing out…" : "Sign out"}
    </button>
  );
}
