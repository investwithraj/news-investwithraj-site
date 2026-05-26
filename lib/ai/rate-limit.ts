// Simple IP-based rate limiter — in-memory Map per Vercel instance.
// Good enough for Day-1 abuse control on the AI endpoints. Replace with
// Vercel KV or Upstash Redis if traffic grows.

const buckets = new Map<string, { count: number; resetAt: number }>();

export interface RateLimitConfig {
  /** Max calls in the window */
  max: number;
  /** Window length in milliseconds */
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

export function checkRateLimit(
  ip: string,
  config: RateLimitConfig = { max: 5, windowMs: 60 * 60 * 1000 }
): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(ip);
  if (!bucket || bucket.resetAt < now) {
    const fresh = { count: 1, resetAt: now + config.windowMs };
    buckets.set(ip, fresh);
    return { allowed: true, remaining: config.max - 1, resetAt: fresh.resetAt };
  }
  if (bucket.count >= config.max) {
    return { allowed: false, remaining: 0, resetAt: bucket.resetAt };
  }
  bucket.count++;
  return {
    allowed: true,
    remaining: config.max - bucket.count,
    resetAt: bucket.resetAt,
  };
}

/** Extract client IP from Next request headers. */
export function getClientIp(headers: Headers): string {
  return (
    headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    headers.get("x-real-ip") ||
    "unknown"
  );
}
