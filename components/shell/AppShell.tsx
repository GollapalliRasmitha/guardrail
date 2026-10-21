import type { ReactNode } from "react";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { LiveStatus } from "@/components/live/LiveStatus";
import { MobileNav } from "./MobileNav";
import { NavLinks } from "./NavLinks";
import { SignOutButton } from "./SignOutButton";

/** The dashboard frame: sidebar on desktop (lg+), top bar + slide-in menu on phones and tablets. */
export function AppShell({
  email,
  openAlerts,
  children,
}: {
  email: string;
  openAlerts: number;
  children: ReactNode;
}) {
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[15rem_1fr]">
      <a
        href="#main"
        className="sr-only z-50 rounded-lg bg-accent px-4 py-2 text-accent-ink focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>

      <aside className="hidden border-r border-line bg-panel lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col lg:p-4">
        <Link href="/dashboard" className="mb-8 rounded-md px-2 pt-1" aria-label="GuardRail overview">
          <Logo />
        </Link>
        <nav aria-label="Main">
          <NavLinks openAlerts={openAlerts} />
        </nav>
        <div className="mt-auto border-t border-line pt-3">
          <p className="truncate px-3 pb-2 font-mono text-xs text-muted" title={email}>
            {email}
          </p>
          <SignOutButton />
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-line bg-ground/85 px-4 backdrop-blur sm:px-6">
          <div className="flex items-center gap-3">
            <MobileNav email={email} openAlerts={openAlerts} />
            <Link href="/dashboard" className="rounded-md lg:hidden" aria-label="GuardRail overview">
              <Logo />
            </Link>
          </div>

          <LiveStatus />
        </header>
        <main id="main" tabIndex={-1} className="mx-auto max-w-7xl px-4 py-6 outline-none sm:px-6 sm:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}

/** Page heading used by every dashboard page. */
export function PageHeader({
  title,
  eyebrow,
  children,
}: {
  title: string;
  eyebrow?: string;
  children?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1 className="mt-1 font-display text-2xl font-semibold sm:text-3xl">{title}</h1>
      </div>
      {children}
    </div>
  );
}
