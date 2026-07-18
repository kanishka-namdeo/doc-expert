/**
 * In-memory rate limiter for single-instance deployments.
 * Uses a sliding window counter algorithm.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const MAX_STORE_SIZE = 10_000;
const store = new Map<string, RateLimitEntry>();

// Cleanup expired entries every 60 seconds
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (entry.resetAt < now) {
      store.delete(key);
    }
  }
}, 60_000);

// Allow the cleanup interval to not prevent process exit
if (cleanupInterval.unref) {
  cleanupInterval.unref();
}

function evictIfNeeded(): void {
  if (store.size <= MAX_STORE_SIZE) return;
  const now = Date.now();
  // First pass: remove expired entries
  for (const [key, entry] of store.entries()) {
    if (entry.resetAt < now) {
      store.delete(key);
    }
  }
  // Second pass: if still over limit, remove oldest entries
  if (store.size > MAX_STORE_SIZE) {
    const sorted = [...store.entries()].sort((a, b) => a[1].resetAt - b[1].resetAt);
    const toRemove = store.size - MAX_STORE_SIZE;
    for (let i = 0; i < toRemove; i++) {
      store.delete(sorted[i][0]);
    }
  }
}

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
  evictIfNeeded();
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
  const isDev = process.env.NODE_ENV === 'development';

  if (path.startsWith('/api/chat')) {
    return { limit: isDev ? 300 : 30, windowMs: 60_000 };
  }
  if (path.startsWith('/api/documents/upload')) {
    return { limit: isDev ? 100 : 10, windowMs: 60_000 };
  }
  // Exclude session checks from rate limiting (read-only, called frequently)
  if (path === '/api/auth/get-session') {
    return null;
  }
  if (path.startsWith('/api/auth')) {
    return { limit: isDev ? 120 : 5, windowMs: 60_000 };
  }
  return null;
}
