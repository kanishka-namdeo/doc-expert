export function SkeletonDocumentViewer() {
  return (
    <div
      className="flex h-full flex-col"
      aria-busy="true"
      aria-live="polite"
      aria-label="Loading document"
    >
      <div className="border-b p-4">
        <div className="skeleton-shimmer h-6 w-1/3 rounded" />
        <div className="skeleton-shimmer h-4 w-1/4 mt-2 rounded" />
      </div>
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-3xl space-y-4">
          <div className="skeleton-shimmer h-4 w-full rounded" />
          <div className="skeleton-shimmer h-4 w-full rounded" />
          <div className="skeleton-shimmer h-4 w-5/6 rounded" />
          <div className="skeleton-shimmer h-4 w-full rounded" />
          <div className="skeleton-shimmer h-4 w-4/5 rounded" />
          <div className="skeleton-shimmer h-4 w-full rounded" />
          <div className="skeleton-shimmer h-4 w-3/4 rounded" />
        </div>
      </div>
    </div>
  );
}
