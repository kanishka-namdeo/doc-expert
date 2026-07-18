'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { authClient } from '@/lib/auth/client';
import { Button } from '@/components/ui/button';
import { extendSession } from '@/lib/auth/session-monitor';

interface SessionWarningModalProps {
  onDismiss: () => void;
  timeRemaining?: number;
}

function formatTimeRemaining(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function SessionWarningModal({ onDismiss, timeRemaining }: SessionWarningModalProps) {
  const router = useRouter();
  const [remaining, setRemaining] = useState<number>(timeRemaining ?? 0);

  useEffect(() => {
    if (timeRemaining) setRemaining(timeRemaining);
  }, [timeRemaining]);

  useEffect(() => {
    const timer = setInterval(() => {
      setRemaining((prev) => {
        const next = prev - 1000;
        return next > 0 ? next : 0;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const handleExtend = async () => {
    await extendSession();
    onDismiss();
  };

  const handleLogout = async () => {
    await authClient.signOut();
    router.push('/login');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg border bg-background p-6 shadow-lg">
        <h2 className="text-lg font-semibold mb-2">Session Expiring Soon</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Your session will expire soon. Would you like to extend it?
        </p>
        <div className="mb-4 rounded-md bg-muted p-3 text-center">
          <span className="text-2xl font-mono font-semibold tabular-nums">
            {formatTimeRemaining(remaining)}
          </span>
          <span className="ml-2 text-xs text-muted-foreground">remaining</span>
        </div>
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={handleLogout}>
            Logout
          </Button>
          <Button onClick={handleExtend}>
            Extend Session
          </Button>
        </div>
      </div>
    </div>
  );
}
