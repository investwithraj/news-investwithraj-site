const WINDOW_SECONDS = 15 * 60;
const CLIENT_LIMIT = 8;
const GLOBAL_LIMIT = 60;
const LOCAL_LIMIT = 10_000;

interface LocalBucket {
  count: number;
  resetAt: number;
}

export interface AuthLimitDecision {
  allowed: boolean;
  available: boolean;
  retryAfterSeconds: number;
  scope: "client" | "global" | "unavailable";
}

const localBuckets = new Map<string, LocalBucket>();

function productionRuntime(): boolean {
  return (
    process.env.NODE_ENV === "production" ||
    Boolean(process.env.VERCEL) ||
    Boolean(process.env.VERCEL_ENV)
  );
}

function clientIp(request: Request): string {
  const hosted = Boolean(process.env.VERCEL || process.env.VERCEL_ENV);
  const raw = hosted
    ? request.headers.get("x-vercel-forwarded-for")
    : productionRuntime()
      ? null
      : request.headers.get("x-real-ip") ||
        request.headers.get("x-forwarded-for");
  const candidate = raw?.split(",")[0]?.trim() ?? "";
  return /^[0-9a-f:.]{2,64}$/i.test(candidate)
    ? candidate
    : productionRuntime()
      ? "unknown"
      : "local-development";
}

async function fingerprint(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function takeLocal(
  key: string,
  limit: number,
  now: number,
): AuthLimitDecision {
  if (localBuckets.size >= LOCAL_LIMIT) {
    for (const [storedKey, bucket] of localBuckets) {
      if (bucket.resetAt <= now || localBuckets.size >= LOCAL_LIMIT) {
        localBuckets.delete(storedKey);
      }
    }
  }
  const current = localBuckets.get(key);
  if (!current || current.resetAt <= now) {
    localBuckets.set(key, {
      count: 1,
      resetAt: now + WINDOW_SECONDS * 1_000,
    });
    return {
      allowed: true,
      available: true,
      retryAfterSeconds: WINDOW_SECONDS,
      scope: key.endsWith(":global") ? "global" : "client",
    };
  }
  current.count += 1;
  return {
    allowed: current.count <= limit,
    available: true,
    retryAfterSeconds: Math.max(
      1,
      Math.ceil((current.resetAt - now) / 1_000),
    ),
    scope: key.endsWith(":global") ? "global" : "client",
  };
}

export async function consumeInternalAuthFailure(
  request: Request,
): Promise<AuthLimitDecision> {
  const now = Date.now();
  const identifier = await fingerprint(
    `news-internal-auth|${clientIp(request)}`,
  );
  const localClient = takeLocal(`auth:${identifier}`, CLIENT_LIMIT, now);
  if (!localClient.allowed) return localClient;
  const localGlobal = takeLocal("auth:global", GLOBAL_LIMIT, now);
  if (!localGlobal.allowed) return localGlobal;

  const url =
    process.env.UPSTASH_REDIS_REST_URL?.trim() ||
    process.env.KV_REST_API_URL?.trim();
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN?.trim() ||
    process.env.KV_REST_API_TOKEN?.trim();
  if (!url || !token) {
    if (!productionRuntime()) return localClient;
    return {
      allowed: false,
      available: false,
      retryAfterSeconds: WINDOW_SECONDS,
      scope: "unavailable",
    };
  }

  const script = `
local clientCount = redis.call("INCR", KEYS[1])
if clientCount == 1 then redis.call("EXPIRE", KEYS[1], tonumber(ARGV[1])) end
local globalCount = redis.call("INCR", KEYS[2])
if globalCount == 1 then redis.call("EXPIRE", KEYS[2], tonumber(ARGV[1])) end
local clientTtl = redis.call("TTL", KEYS[1])
local globalTtl = redis.call("TTL", KEYS[2])
if clientTtl < 0 then
  redis.call("EXPIRE", KEYS[1], tonumber(ARGV[1]))
  clientTtl = tonumber(ARGV[1])
end
if globalTtl < 0 then
  redis.call("EXPIRE", KEYS[2], tonumber(ARGV[1]))
  globalTtl = tonumber(ARGV[1])
end
return {clientCount, globalCount, clientTtl, globalTtl}
`;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        "EVAL",
        script,
        2,
        `iwr:auth-failure:${identifier}`,
        "iwr:auth-failure:global",
        WINDOW_SECONDS,
      ]),
      cache: "no-store",
    });
    if (!response.ok) throw new Error("shared limiter failed");
    const payload = (await response.json()) as { result?: unknown };
    if (
      !Array.isArray(payload.result) ||
      payload.result.length !== 4 ||
      payload.result.some((value) => !Number.isFinite(Number(value)))
    ) {
      throw new Error("shared limiter returned invalid state");
    }
    const [clientCount, globalCount, clientTtl, globalTtl] =
      payload.result.map(Number);
    if (globalCount > GLOBAL_LIMIT) {
      return {
        allowed: false,
        available: true,
        retryAfterSeconds: Math.max(1, globalTtl),
        scope: "global",
      };
    }
    return {
      allowed: clientCount <= CLIENT_LIMIT,
      available: true,
      retryAfterSeconds: Math.max(1, clientTtl),
      scope: "client",
    };
  } catch {
    if (!productionRuntime()) return localClient;
    return {
      allowed: false,
      available: false,
      retryAfterSeconds: WINDOW_SECONDS,
      scope: "unavailable",
    };
  }
}
