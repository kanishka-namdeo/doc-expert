export function SkeletonChat() {
  return (
    <div
      className="flex flex-col space-y-4 p-4"
      aria-busy="true"
      aria-live="polite"
      aria-label="Loading messages"
    >
      <div className="flex justify-start">
        <div className="skeleton-shimmer h-16 w-2/3 rounded-lg" />
      </div>
      <div className="flex justify-end">
        <div className="skeleton-shimmer h-12 w-1/2 rounded-lg" />
      </div>
      <div className="flex justify-start">
        <div className="skeleton-shimmer h-20 w-3/4 rounded-lg" />
      </div>
      <div className="flex justify-end">
        <div className="skeleton-shimmer h-10 w-2/5 rounded-lg" />
      </div>
    </div>
  );
}
