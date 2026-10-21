import type { AlertStatus } from "./types";

// open ──► acknowledged ──► resolved
//   └──────────────────────► resolved ──► open (reopen)
// "Acknowledged" = I've seen it and I'm on it. Going back to open is allowed from either.
const MOVES: Record<AlertStatus, { to: AlertStatus; label: string }[]> = {
  open: [
    { to: "acknowledged", label: "Acknowledge" },
    { to: "resolved", label: "Resolve" },
  ],
  acknowledged: [
    { to: "resolved", label: "Resolve" },
    { to: "open", label: "Back to open" },
  ],
  resolved: [{ to: "open", label: "Reopen" }],
};

export function canMove(from: AlertStatus, to: AlertStatus): boolean {
  return MOVES[from].some((m) => m.to === to);
}

/** The buttons to show for an alert in this status, main action first. */
export function nextActions(from: AlertStatus) {
  return MOVES[from];
}
