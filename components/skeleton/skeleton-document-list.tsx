export function SkeletonDocumentList() {
  return (
    <div
      className="space-y-3 p-4"
      aria-busy="true"
      aria-live="polite"
      aria-label="Loading documents"
    >
      {[...Array(4)].map((_, i) => (
        <div key={i} className="flex items-start gap-3 rounded-lg border p-3">
          <div className="skeleton-shimmer h-8 w-8 rounded" />
          <div className="flex-1 space-y-2">
            <div className="skeleton-shimmer h-4 w-3/4 rounded" />
            <div className="skeleton-shimmer h-3 w-1/2 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}
