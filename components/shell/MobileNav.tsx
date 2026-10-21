"use client";

import { Menu, X } from "lucide-react";
import { useRef, type ReactNode } from "react";
import { Logo } from "@/components/Logo";
import type { Base } from "./nav";
import { NavLinks } from "./NavLinks";

/**
 * Phone menu. A native <dialog> opened with showModal() gives keyboard users the right behaviour for free:
 * focus moves inside, Tab stays inside, Escape closes it, and focus returns to the menu button afterwards.
 */
export function MobileNav({
  base,
  account,
  openAlerts,
}: {
  base: Base;
  account: ReactNode;
  openAlerts: number;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const close = () => dialog.current?.close();

  return (
    <>
      <button
        type="button"
        onClick={() => dialog.current?.showModal()}
        className="grid size-11 place-items-center rounded-lg border border-line text-text lg:hidden"
        aria-label="Open menu"
        aria-haspopup="dialog"
      >
        <Menu className="size-5" aria-hidden />
      </button>
      <dialog
        ref={dialog}
        aria-label="Menu"
        onClick={(e) => e.target === dialog.current && close()} // tap on the dimmed backdrop closes it
        className="m-0 h-dvh max-h-none w-72 max-w-[85vw] border-r border-line bg-panel p-0 text-text backdrop:bg-black/60"
      >
        <div className="flex h-full flex-col p-4">
          <div className="mb-6 flex items-center justify-between">
            <Logo />
            <button
              type="button"
              onClick={close}
              className="grid size-11 place-items-center rounded-lg text-muted hover:text-text"
              aria-label="Close menu"
            >
              <X className="size-5" aria-hidden />
            </button>
          </div>
          <nav aria-label="Main">
            <NavLinks base={base} onNavigate={close} openAlerts={openAlerts} />
          </nav>
          <div className="mt-auto border-t border-line pt-3">{account}</div>
        </div>
      </dialog>
    </>
  );
}
