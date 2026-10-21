"use client";

import { RotateCw } from "lucide-react";
import { useState, type ReactNode } from "react";

/**
 * A card that turns over to show how a rule works: on hover (mouse), or by click / tap / Enter / Space (it's a real
 * button, so keyboards and screen readers get it for free). With reduced motion it switches without turning.
 */
export function FlipCard({ front, back, label }: { front: ReactNode; back: ReactNode; label: string }) {
  const [flipped, setFlipped] = useState(false);
  return (
    <button
      type="button"
      className="flip block w-full rounded-xl text-left"
      aria-pressed={flipped}
      aria-label={`${label}: ${flipped ? "hide" : "show"} how it's detected`}
      onClick={() => setFlipped((f) => !f)}
    >
      <span className="flip-inner">
        <span className="glass flex min-h-48 flex-col rounded-xl p-5" aria-hidden={flipped}>
          {front}
          <span className="mt-auto inline-flex items-center gap-1 pt-4 text-xs text-muted">
            <RotateCw className="size-3" aria-hidden /> How it&apos;s detected
          </span>
        </span>
        <span
          className="flip-back flex min-h-48 flex-col rounded-xl border border-accent/40 bg-panel-2 p-5"
          aria-hidden={!flipped}
        >
          {back}
        </span>
      </span>
    </button>
  );
}
