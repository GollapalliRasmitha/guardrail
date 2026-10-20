import type { ReactNode } from "react";

/** What to show when there's nothing yet: what will appear here, and what happens next. */
export function EmptyState({
  icon,
  title,
  children,
  action,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-line px-6 py-12 text-center">
      <span
        className="grid size-14 place-items-center rounded-full border border-line bg-panel-2 text-accent"
        aria-hidden
      >
        {icon}
      </span>
      <h2 className="mt-4 font-display text-lg font-semibold text-text">{title}</h2>
      <div className="mt-1.5 max-w-md text-sm text-muted">{children}</div>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
