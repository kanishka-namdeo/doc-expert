export function SkeletonConnectors() {
  return (
    <div
      className="space-y-4 p-4"
      aria-busy="true"
      aria-live="polite"
      aria-label="Loading connectors"
    >
      {[...Array(2)].map((_, i) => (
        <div key={i} className="rounded-lg border p-4">
          <div className="flex items-start gap-3">
            <div className="skeleton-shimmer h-12 w-12 rounded-lg" />
            <div className="flex-1 space-y-2">
              <div className="skeleton-shimmer h-5 w-1/3 rounded" />
              <div className="skeleton-shimmer h-4 w-1/2 rounded" />
              <div className="skeleton-shimmer h-8 w-24 mt-2 rounded" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
