import { authClient } from './client';

let monitorInterval: NodeJS.Timeout | null = null;

export function startSessionMonitor(
  onWarning: () => void,
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
      const fiveMinutes = 5 * 60 * 1000;

      if (timeRemaining <= 0) {
        onExpired();
      } else if (timeRemaining <= fiveMinutes) {
        onWarning();
      }
    } catch (err) {
      console.error('Session monitor error:', err);
    }
  }, 60 * 1000); // Check every minute
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
    console.log('Session extended until:', new Date(result.expiresAt));
  } catch (err) {
    console.error('Failed to extend session:', err);
    throw err;
  }
}

export function stopSessionMonitor() {
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
  }
}
