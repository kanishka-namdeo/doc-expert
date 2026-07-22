export function SkeletonSidebar() {
  return (
    <div
      className="flex h-full flex-col border-r bg-card p-4"
      aria-busy="true"
      aria-live="polite"
      aria-label="Loading sidebar"
    >
      <div className="space-y-3">
        <div className="skeleton-shimmer h-6 w-3/4 rounded" />
        <div className="skeleton-shimmer h-4 w-1/2 rounded" />
        <div className="skeleton-shimmer h-4 w-2/3 rounded" />
        <div className="skeleton-shimmer h-4 w-1/3 rounded" />
      </div>
      <div className="mt-6 space-y-3">
        <div className="skeleton-shimmer h-4 w-1/2 rounded" />
        <div className="skeleton-shimmer h-4 w-3/4 rounded" />
        <div className="skeleton-shimmer h-4 w-1/2 rounded" />
      </div>
    </div>
  );
}
