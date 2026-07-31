// Shared abuse controls for paid AI endpoints.
//
// Production uses the project's Upstash-compatible KV store. Redis scripts
// make increments atomic across every Vercel instance; if the shared store is
// missing or unavailable in production, callers fail closed instead of
// silently falling back to a per-process bucket.
//
// Local development intentionally uses a small in-memory fallback so the
// first-party UI remains usable without production infrastructure.

import { createHash } from "node:crypto";
import { isIP } from "node:net";

const KV_URL = process.env.KV_REST_API_URL || "";
const KV_TOKEN = process.env.KV_REST_API_TOKEN || "";

const localBuckets = new Map<string, { count: number; resetAt: number }>();
const localClaims = new Map<string, number>();

const RATE_LIMIT_SCRIPT = `
local count = redis.call("INCR", KEYS[1])
if count == 1 then
  redis.call("PEXPIRE", KEYS[1], ARGV[1])
end
local ttl = redis.call("PTTL", KEYS[1])
return { count, ttl }
`;

export interface RateLimitConfig {
  /** Stable endpoint/cost-bucket name. */
  namespace: string;
  /** Max calls in the window. */
  max: number;
  /** Window length in milliseconds. */
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  backend: "redis" | "memory" | "unavailable";
  reason?: "limit" | "unavailable";
}

export interface OneTimeClaimResult {
  claimed: boolean;
  backend: "redis" | "memory" | "unavailable";
  reason?: "used" | "unavailable";
}

function sharedStoreConfigured(): boolean {
  return Boolean(KV_URL && KV_TOKEN);
}

function sharedStoreRequired(): boolean {
  return process.env.NODE_ENV === "production" || Boolean(process.env.VERCEL);
}

function safeKeyPart(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function rateKey(identifier: string, namespace: string): string {
  return `iwr:ai-limit:${namespace}:${safeKeyPart(identifier)}`;
}

function claimKey(namespace: string, id: string): string {
  return `iwr:one-time:${namespace}:${safeKeyPart(id)}`;
}

async function redisCommand(command: unknown[]): Promise<unknown> {
  const response = await fetch(KV_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${KV_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`KV request failed (${response.status})`);
  }
  const body = (await response.json()) as { result?: unknown; error?: string };
  if (body.error) throw new Error("KV command failed");
  return body.result;
}

function unavailableRateLimit(): RateLimitResult {
  return {
    allowed: false,
    remaining: 0,
    resetAt: Date.now(),
    backend: "unavailable",
    reason: "unavailable",
  };
}

function validateConfig(config: RateLimitConfig): void {
  if (
    !config.namespace ||
    !Number.isSafeInteger(config.max) ||
    config.max < 1 ||
    !Number.isSafeInteger(config.windowMs) ||
    config.windowMs < 1_000
  ) {
    throw new Error("Invalid rate-limit configuration");
  }
}

/**
 * Atomically consume one unit from a named cost bucket.
 *
 * Raw IPs/session identifiers are never stored in Redis; only SHA-256-derived
 * key material leaves the function.
 */
export async function checkRateLimit(
  identifier: string,
  config: RateLimitConfig,
): Promise<RateLimitResult> {
  validateConfig(config);
  if (!identifier || identifier === "unknown") return unavailableRateLimit();

  const key = rateKey(identifier, config.namespace);
  const now = Date.now();

  if (sharedStoreConfigured()) {
    try {
      const result = await redisCommand([
        "EVAL",
        RATE_LIMIT_SCRIPT,
        1,
        key,
        config.windowMs,
      ]);
      if (
        !Array.isArray(result) ||
        result.length < 2 ||
        !Number.isFinite(Number(result[0])) ||
        !Number.isFinite(Number(result[1]))
      ) {
        return unavailableRateLimit();
      }
      const count = Number(result[0]);
      const ttl = Math.max(0, Number(result[1]));
      return {
        allowed: count <= config.max,
        remaining: Math.max(0, config.max - count),
        resetAt: now + ttl,
        backend: "redis",
        reason: count <= config.max ? undefined : "limit",
      };
    } catch {
      return unavailableRateLimit();
    }
  }

  if (sharedStoreRequired()) return unavailableRateLimit();

  const bucket = localBuckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    const fresh = { count: 1, resetAt: now + config.windowMs };
    localBuckets.set(key, fresh);
    return {
      allowed: true,
      remaining: config.max - 1,
      resetAt: fresh.resetAt,
      backend: "memory",
    };
  }

  bucket.count += 1;
  return {
    allowed: bucket.count <= config.max,
    remaining: Math.max(0, config.max - bucket.count),
    resetAt: bucket.resetAt,
    backend: "memory",
    reason: bucket.count <= config.max ? undefined : "limit",
  };
}

/**
 * Atomically claim an opaque token ID once. Used to make paid voice grants
 * single-use even when concurrent requests land on different instances.
 */
export async function claimOnce(
  namespace: string,
  id: string,
  ttlMs: number,
): Promise<OneTimeClaimResult> {
  if (!namespace || !id || !Number.isSafeInteger(ttlMs) || ttlMs < 1_000) {
    return { claimed: false, backend: "unavailable", reason: "unavailable" };
  }

  const key = claimKey(namespace, id);
  if (sharedStoreConfigured()) {
    try {
      const result = await redisCommand(["SET", key, "1", "PX", ttlMs, "NX"]);
      return result === "OK"
        ? { claimed: true, backend: "redis" }
        : { claimed: false, backend: "redis", reason: "used" };
    } catch {
      return { claimed: false, backend: "unavailable", reason: "unavailable" };
    }
  }

  if (sharedStoreRequired()) {
    return { claimed: false, backend: "unavailable", reason: "unavailable" };
  }

  const now = Date.now();
  const existing = localClaims.get(key);
  if (existing && existing > now) {
    return { claimed: false, backend: "memory", reason: "used" };
  }
  localClaims.set(key, now + ttlMs);
  return { claimed: true, backend: "memory" };
}

/**
 * Extract the client IP from infrastructure-owned headers in production.
 *
 * Vercel documents x-vercel-forwarded-for as its non-overridable copy of the
 * client IP. Generic forwarding headers are accepted only outside Vercel for
 * local reverse-proxy development.
 */
export function getClientIp(headers: Headers): string {
  const onVercel = Boolean(process.env.VERCEL);
  const production = process.env.NODE_ENV === "production";
  const raw = onVercel
    ? headers.get("x-vercel-forwarded-for")
    : production
      ? null
      : headers.get("x-real-ip") || headers.get("x-forwarded-for");
  const candidate = raw?.split(",")[0]?.trim() ?? "";
  if (isIP(candidate)) return candidate;
  return production || onVercel ? "unknown" : "local-development";
}

/**
 * Browser-facing paid routes are only callable as same-origin mutations.
 * This prevents another website from spending credits through a visitor's
 * browser. Distributed quotas remain the bot/server-side abuse boundary.
 */
export function isFirstPartyMutation(request: Request): boolean {
  let requestOrigin: string;
  try {
    requestOrigin = new URL(request.url).origin;
  } catch {
    return false;
  }

  const origin = request.headers.get("origin");
  if (!origin || origin !== requestOrigin) return false;

  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin") return false;

  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  return contentType.startsWith("application/json");
}
