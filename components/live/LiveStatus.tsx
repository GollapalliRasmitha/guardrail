"use client";

import { LiveDot } from "@/components/ui/LiveDot";
import { useLive } from "./LiveProvider";

/** The header's connection dot. */
export function LiveStatus() {
  return <LiveDot state={useLive().state} />;
}
