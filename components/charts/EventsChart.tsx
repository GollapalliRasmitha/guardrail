"use client";

import { useState, type KeyboardEvent } from "react";
import { niceMax } from "@/lib/dashboard/buckets";
import { formatHour } from "@/lib/format";

export type ChartBucket = { start: string; homehaat: number; oppora: number; total: number };

// Hand-drawn SVG (no chart library): small, fully styled by our tokens, nothing loaded from elsewhere.
const W = 720;
const H = 200;
const PAD = { top: 12, right: 8, bottom: 26, left: 34 };
const plotW = W - PAD.left - PAD.right;
const plotH = H - PAD.top - PAD.bottom;
const GAP = 2; // surface gap between stacked segments

const SERIES = [
  { key: "homehaat", label: "HomeHaat", fill: "var(--chart-homehaat)" },
  { key: "oppora", label: "Oppora", fill: "var(--chart-oppora)" },
] as const;

/** A bar segment whose top corners are rounded (the "data end"); the bottom stays square on the baseline. */
function topRounded(x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h);
  return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`;
}

/**
 * Events per hour for the last 24 hours, stacked by site. Hover or tap a bar, or focus the chart and use ← → keys,
 * to see that hour's numbers. A table view below gives the same numbers to screen readers.
 */
export function EventsChart({ buckets }: { buckets: ChartBucket[] }) {
  const [active, setActive] = useState<number | null>(null);
  const total = buckets.reduce((sum, b) => sum + b.total, 0);
  const max = niceMax(Math.max(...buckets.map((b) => b.total)));
  const slot = plotW / buckets.length;
  const barW = Math.max(4, slot * 0.62);
  const y = (v: number) => PAD.top + plotH - (v / max) * plotH;

  if (total === 0) {
    return <p className="py-10 text-center text-sm text-muted">No events in the last 24 hours.</p>;
  }

  const onKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowRight")
      setActive((i) => Math.min(buckets.length - 1, (i ?? buckets.length - 1) + (i === null ? 0 : 1)));
    else if (e.key === "ArrowLeft") setActive((i) => Math.max(0, (i ?? buckets.length - 1) - 1));
    else if (e.key === "Escape") setActive(null);
    else return;
    e.preventDefault();
  };
  const shown = active === null ? null : buckets[active]!;

  return (
    <figure>
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted" aria-hidden>
        {SERIES.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm" style={{ background: s.fill }} />
            {s.label}
          </span>
        ))}
      </div>

      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full touch-pan-y rounded-md"
          role="img"
          aria-label={`Events per hour, last 24 hours: ${total} in total. Use the table below for every hour.`}
          tabIndex={0}
          onKeyDown={onKey}
          onBlur={() => setActive(null)}
          onMouseLeave={() => setActive(null)}
        >
          {[0, max / 2, max].map((tick) => (
            <g key={tick}>
              <line
                x1={PAD.left}
                x2={W - PAD.right}
                y1={y(tick)}
                y2={y(tick)}
                stroke="var(--line)"
                strokeWidth={1}
              />
              <text
                x={PAD.left - 6}
                y={y(tick) + 4}
                textAnchor="end"
                className="fill-muted font-mono text-[11px]"
              >
                {tick}
              </text>
            </g>
          ))}

          {buckets.map((b, i) => {
            const x = PAD.left + i * slot + (slot - barW) / 2;
            const segments = SERIES.map((s) => ({ ...s, value: b[s.key] })).filter((s) => s.value > 0);
            let base = y(0);
            return (
              <g key={b.start} opacity={active === null || active === i ? 1 : 0.45}>
                {segments.map((s, j) => {
                  const h = Math.max(2, (s.value / max) * plotH - (j > 0 ? GAP : 0));
                  const top = base - h - (j > 0 ? GAP : 0);
                  const isTop = j === segments.length - 1;
                  const d = isTop ? topRounded(x, top, barW, h, 4) : `M${x},${top}h${barW}v${h}h${-barW}Z`;
                  base = top;
                  return <path key={s.key} d={d} fill={s.fill} />;
                })}
                {/* Hit target: the whole column, bigger than the bar, for mouse and touch. */}
                <rect
                  x={PAD.left + i * slot}
                  y={PAD.top}
                  width={slot}
                  height={plotH}
                  fill="transparent"
                  onMouseEnter={() => setActive(i)}
                  onClick={() => setActive(i)}
                />
              </g>
            );
          })}

          {buckets.map((b, i) =>
            i % 6 === 0 || i === buckets.length - 1 ? (
              <text
                key={`x${b.start}`}
                x={PAD.left + i * slot + slot / 2}
                y={H - 8}
                textAnchor="middle"
                className="fill-muted font-mono text-[11px]"
              >
                {formatHour(b.start)}
              </text>
            ) : null,
          )}
        </svg>

        {shown && active !== null && (
          <div
            role="status"
            className="pointer-events-none absolute top-0 rounded-lg border border-line bg-panel-2 px-3 py-2 text-xs shadow-lg"
            style={{
              left: `${((PAD.left + (active + 0.5) * slot) / W) * 100}%`,
              transform: active > buckets.length / 2 ? "translateX(-105%)" : "translateX(5%)",
            }}
          >
            <p className="font-mono text-muted">{formatHour(shown.start)} IST</p>
            {SERIES.map((s) => (
              <p key={s.key} className="mt-0.5 flex items-center gap-1.5 text-text">
                <span className="size-2 rounded-sm" style={{ background: s.fill }} aria-hidden />
                {s.label}: <span className="font-mono">{shown[s.key]}</span>
              </p>
            ))}
          </div>
        )}
      </div>

      <details className="mt-3 text-sm">
        <summary className="inline-flex min-h-11 cursor-pointer items-center text-muted hover:text-text">
          Show as a table
        </summary>
        <div className="mt-2 max-h-72 overflow-y-auto">
          <table className="w-full text-left text-xs">
            <caption className="sr-only">Events per hour, last 24 hours</caption>
            <thead className="sticky top-0 bg-panel text-muted">
              <tr>
                <th scope="col" className="py-1 font-normal">
                  Hour (IST)
                </th>
                <th scope="col" className="py-1 font-normal">
                  HomeHaat
                </th>
                <th scope="col" className="py-1 font-normal">
                  Oppora
                </th>
                <th scope="col" className="py-1 font-normal">
                  Total
                </th>
              </tr>
            </thead>
            <tbody className="font-mono">
              {buckets.map((b) => (
                <tr key={b.start} className="border-t border-line/50">
                  <td className="py-1">{formatHour(b.start)}</td>
                  <td>{b.homehaat}</td>
                  <td>{b.oppora}</td>
                  <td>{b.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
