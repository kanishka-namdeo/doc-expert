import { authClient } from './client';
import { getClientLogger } from '@/lib/client-logger';

const logger = getClientLogger('session-monitor');

let monitorInterval: NodeJS.Timeout | null = null;

const FIFTEEN_MINUTES = 15 * 60 * 1000;
const FIVE_MINUTES = 5 * 60 * 1000;

export function startSessionMonitor(
  onEarlyWarning: (timeRemaining: number) => void,
  onWarning: (timeRemaining: number) => void,
  onExpired: () => void
) {
  // Clear any existing monitor
  stopSessionMonitor();

  monitorInterval = setInterval(async () => {
    try {
      const { data: session } = await authClient.getSession();

      if (!session?.session?.expiresAt) {
        onExpired();
        return;
      }

      const expiresAt = new Date(session.session.expiresAt);
      const now = new Date();
      const timeRemaining = expiresAt.getTime() - now.getTime();

      if (timeRemaining <= 0) {
        onExpired();
      } else if (timeRemaining <= FIVE_MINUTES) {
        onWarning(timeRemaining);
      } else if (timeRemaining <= FIFTEEN_MINUTES) {
        onEarlyWarning(timeRemaining);
      }
    } catch (err) {
      logger.error('Session monitor error', { err });
    }
  }, 30 * 1000); // Check every 30 seconds
}

export async function extendSession() {
  try {
    const response = await fetch('/api/auth/extend-session', {
      method: 'POST',
      credentials: 'include',
    });
    
    if (!response.ok) {
      throw new Error('Failed to extend session');
    }
    
    const result = await response.json();
    logger.info('Session extended', { expiresAt: result.expiresAt });
  } catch (err) {
    logger.error('Failed to extend session', { err });
    throw err;
  }
}

export function stopSessionMonitor() {
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
  }
}
