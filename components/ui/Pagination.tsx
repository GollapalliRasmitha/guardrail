import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import type { Route } from "next";

/** Previous / Next links. `hrefFor(page)` builds each link so the page's filters are kept. */
export function Pagination({
  page,
  pages,
  total,
  hrefFor,
}: {
  page: number;
  pages: number;
  total: number;
  hrefFor: (page: number) => Route;
}) {
  if (pages <= 1) return null;
  const link =
    "inline-flex min-h-11 items-center gap-1 rounded-lg border border-line px-3 text-sm hover:bg-panel-2";
  const off =
    "inline-flex min-h-11 items-center gap-1 rounded-lg border border-line/50 px-3 text-sm text-muted/50";
  return (
    <nav aria-label="Pages" className="mt-5 flex items-center justify-between gap-3">
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} className={link} rel="prev">
          <ChevronLeft className="size-4" aria-hidden /> Newer
        </Link>
      ) : (
        <span className={off} aria-disabled="true">
          <ChevronLeft className="size-4" aria-hidden /> Newer
        </span>
      )}
      <p className="font-mono text-xs text-muted">
        Page {page} of {pages} · {total} events
      </p>
      {page < pages ? (
        <Link href={hrefFor(page + 1)} className={link} rel="next">
          Older <ChevronRight className="size-4" aria-hidden />
        </Link>
      ) : (
        <span className={off} aria-disabled="true">
          Older <ChevronRight className="size-4" aria-hidden />
        </span>
      )}
    </nav>
  );
}
