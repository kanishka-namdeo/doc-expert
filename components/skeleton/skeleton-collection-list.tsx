export function SkeletonCollectionList() {
  return (
    <div
      className="space-y-3 p-4"
      aria-busy="true"
      aria-live="polite"
      aria-label="Loading collections"
    >
      {[...Array(3)].map((_, i) => (
        <div key={i} className="rounded-lg border p-4">
          <div className="flex items-start gap-3">
            <div className="skeleton-shimmer h-10 w-10 rounded" />
            <div className="flex-1 space-y-2">
              <div className="skeleton-shimmer h-5 w-1/2 rounded" />
              <div className="skeleton-shimmer h-4 w-3/4 rounded" />
              <div className="skeleton-shimmer h-3 w-1/3 rounded" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
