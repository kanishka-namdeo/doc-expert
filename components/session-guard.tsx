'use client';

import { useState, useEffect } from 'react';
import { startSessionMonitor, stopSessionMonitor } from '@/lib/auth/session-monitor';
import { SessionWarningModal } from './session-warning-modal';

export function SessionGuard({ children }: { children: React.ReactNode }) {
  const [showWarning, setShowWarning] = useState(false);
  const [warningTimeRemaining, setWarningTimeRemaining] = useState<number | undefined>();
  const [sessionTimeRemaining, setSessionTimeRemaining] = useState<number | null>(null);

  useEffect(() => {
    startSessionMonitor(
      (timeRemaining: number) => {
        // Early warning at 15 min — just store the value for the header indicator
        setSessionTimeRemaining(timeRemaining);
        window.dispatchEvent(new CustomEvent('session-time-remaining', { detail: timeRemaining }));
      },
      (timeRemaining: number) => {
        // Critical warning at 5 min — show the modal with countdown
        setSessionTimeRemaining(timeRemaining);
        setWarningTimeRemaining(timeRemaining);
        setShowWarning(true);
        window.dispatchEvent(new CustomEvent('session-time-remaining', { detail: timeRemaining }));
      },
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
      {showWarning && (
        <SessionWarningModal
          onDismiss={() => setShowWarning(false)}
          timeRemaining={warningTimeRemaining}
        />
      )}
    </>
  );
}

export function useSessionTimeRemaining(): number | null {
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    // Listen for custom events dispatched by SessionGuard
    const handler = (e: Event) => {
      const ce = e as CustomEvent<number | null>;
      setRemaining(ce.detail);
    };
    window.addEventListener('session-time-remaining', handler as EventListener);
    return () => window.removeEventListener('session-time-remaining', handler as EventListener);
  }, []);

  return remaining;
}
