type Bucket = { count: number; resetAt: number };

export type RateLimitResult = { allowed: boolean; remaining: number; retryAfterSeconds: number };

/**
 * Fixed-window, in-memory rate limiter. Good enough for a single Node
 * instance; if the app is scaled horizontally or runs on serverless, swap the
 * store for Redis/Upstash behind this same interface.
 */
export function createRateLimiter({ limit, windowMs }: { limit: number; windowMs: number }) {
  const buckets = new Map<string, Bucket>();

  return function check(key: string, now = Date.now()): RateLimitResult {
    if (buckets.size > 10_000) {
      for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
    }
    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(key, bucket);
    }
    bucket.count += 1;
    const allowed = bucket.count <= limit;
    return {
      allowed,
      remaining: Math.max(0, limit - bucket.count),
      retryAfterSeconds: allowed ? 0 : Math.ceil((bucket.resetAt - now) / 1000),
    };
  };
}
