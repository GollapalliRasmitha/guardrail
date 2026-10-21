"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isActive, navFor, type Base } from "./nav";

export function NavLinks({
  base,
  onNavigate,
  openAlerts = 0,
}: {
  base: Base;
  onNavigate?: () => void;
  openAlerts?: number;
}) {
  const pathname = usePathname();
  return (
    <ul className="space-y-1">
      {navFor(base).map(({ href, path, label, icon: Icon }) => {
        const active = isActive(href, pathname, base);
        return (
          <li key={href}>
            <Link
              href={href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm transition ${
                active
                  ? "bg-accent/10 text-accent shadow-[inset_2px_0_0_var(--accent)]"
                  : "text-muted hover:bg-panel-2 hover:text-text"
              }`}
            >
              <Icon className="size-4.5 shrink-0" aria-hidden />
              {label}
              {path === "/alerts" && openAlerts > 0 && (
                <span className="ml-auto rounded-full bg-sev-high/15 px-2 py-0.5 font-mono text-xs text-sev-high">
                  {openAlerts}
                  <span className="sr-only"> open</span>
                </span>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
