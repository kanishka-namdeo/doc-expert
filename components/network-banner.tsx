'use client';

import { useNetworkStatus } from '@/hooks/use-network-status';

export function NetworkBanner() {
  const isOnline = useNetworkStatus();

  if (isOnline) return null;

  return (
    <div className="bg-yellow-500 text-black px-4 py-2 text-center text-sm font-medium">
      You are offline. Some features may not work until you reconnect.
    </div>
  );
}
