interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Periodic cleanup every 60 seconds to prevent memory leaks
let cleanupScheduled = false;

function scheduleCleanup() {
  if (cleanupScheduled) return;
  cleanupScheduled = true;

  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (now >= entry.resetAt) {
        store.delete(key);
      }
    }
  }, 60_000).unref?.();
}

/**
 * In-memory rate limiter (per-instance, suitable for serverless).
 *
 * @param key        - Unique identifier for the rate-limit bucket (e.g. IP + email).
 * @param maxAttempts - Maximum attempts allowed within the window (default: 5).
 * @param windowMs   - Window duration in milliseconds (default: 15 minutes).
 *
 * @returns An object with `allowed` (boolean) and `remaining` (number of attempts left).
 */
export function checkRateLimit(
  key: string,
  maxAttempts = 5,
  windowMs = 15 * 60 * 1000
): { allowed: boolean; remaining: number } {
  scheduleCleanup();

  const now = Date.now();
  const entry = store.get(key);

  // First request or window expired -- start fresh
  if (!entry || now >= entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: maxAttempts - 1 };
  }

  // Within the window
  entry.count += 1;

  if (entry.count > maxAttempts) {
    return { allowed: false, remaining: 0 };
  }

  return { allowed: true, remaining: maxAttempts - entry.count };
}
