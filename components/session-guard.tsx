'use client';

import { useState, useEffect } from 'react';
import { startSessionMonitor, stopSessionMonitor } from '@/lib/auth/session-monitor';
import { SessionWarningModal } from './session-warning-modal';

export function SessionGuard({ children }: { children: React.ReactNode }) {
  const [showWarning, setShowWarning] = useState(false);

  useEffect(() => {
    startSessionMonitor(
      () => setShowWarning(true),
      async () => {
        // Session expired - redirect to login
        window.location.href = '/login';
      }
    );

    return () => {
      stopSessionMonitor();
    };
  }, []);

  return (
    <>
      {children}
      {showWarning && <SessionWarningModal onDismiss={() => setShowWarning(false)} />}
    </>
  );
}
