'use client';

import { useRouter } from 'next/navigation';
import { authClient } from '@/lib/auth/client';
import { Button } from '@/components/ui/button';
import { extendSession } from '@/lib/auth/session-monitor';

interface SessionWarningModalProps {
  onDismiss: () => void;
}

export function SessionWarningModal({ onDismiss }: SessionWarningModalProps) {
  const router = useRouter();

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
          Your session will expire in less than 5 minutes. Would you like to extend it?
        </p>
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
