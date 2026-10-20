import type { ReactNode } from "react";
import Link from "next/link";
import { Logo } from "@/components/Logo";

/** The frame around sign-in and 2FA setup: centred card on the blueprint grid. */
export function AuthCard({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="grid-ground flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <Link href="/" className="mb-8 rounded-md" aria-label="GuardRail home">
        <Logo size="lg" />
      </Link>
      <main className="w-full max-w-sm rounded-2xl border border-line bg-panel/95 p-6 shadow-2xl shadow-black/40 sm:p-8">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="mt-2 font-display text-2xl font-semibold">{title}</h1>
        <div className="mt-6">{children}</div>
      </main>
      <p className="mt-6 font-mono text-xs text-muted">Restricted console · every attempt is logged</p>
    </div>
  );
}
