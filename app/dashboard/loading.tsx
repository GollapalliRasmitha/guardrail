/** Shown instantly while a dashboard page loads its data. */
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <div className="mb-6 h-9 w-48 animate-pulse rounded-lg bg-panel" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-32 animate-pulse rounded-xl border border-line bg-panel" />
        ))}
      </div>
      <div className="mt-6 h-72 animate-pulse rounded-xl border border-line bg-panel" />
    </div>
  );
}
