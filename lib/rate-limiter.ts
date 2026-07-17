/**
 * In-memory rate limiter for single-instance deployments.
 * Uses a sliding window counter algorithm.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Cleanup expired entries every 60 seconds
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (entry.resetAt < now) {
      store.delete(key);
    }
  }
}, 60_000);

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
}

/**
 * Check if a request is within rate limits.
 * @param key - Unique identifier (e.g., userId, IP address)
 * @param limit - Maximum number of requests allowed in the window
 * @param windowMs - Time window in milliseconds
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();

  const entry = store.get(key);
  if (!entry || entry.resetAt < now) {
    // New window
    store.set(key, { count: 1, resetAt: now + windowMs });
    return {
      allowed: true,
      remaining: limit - 1,
      resetAt: new Date(now + windowMs),
    };
  }

  if (entry.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: new Date(entry.resetAt),
    };
  }

  entry.count++;
  return {
    allowed: true,
    remaining: limit - entry.count,
    resetAt: new Date(entry.resetAt),
  };
}

/**
 * Get rate limit configuration for a given path.
 */
export function getRateLimitConfig(path: string): { limit: number; windowMs: number } | null {
  if (path.startsWith('/api/chat')) {
    return { limit: 30, windowMs: 60_000 }; // 30 req/min
  }
  if (path.startsWith('/api/documents/upload')) {
    return { limit: 10, windowMs: 60_000 }; // 10 req/min
  }
  // Exclude session checks from rate limiting (read-only, called frequently)
  if (path === '/api/auth/get-session') {
    return null;
  }
  if (path.startsWith('/api/auth')) {
    return { limit: 5, windowMs: 60_000 }; // 5 req/min
  }
  return null;
}
