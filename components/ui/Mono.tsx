import type { ReactNode } from "react";

/** IPs, times, IDs, codes and MITRE technique IDs are always monospace. */
export function Mono({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <span className={`font-mono text-[0.92em] ${className}`}>{children}</span>;
}
