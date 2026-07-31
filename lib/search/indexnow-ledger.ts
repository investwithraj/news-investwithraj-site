import { createHash, randomBytes } from "node:crypto";

const KV_URL = process.env.KV_REST_API_URL?.trim() ?? "";
const KV_TOKEN = process.env.KV_REST_API_TOKEN?.trim() ?? "";
const TTL_SECONDS = 24 * 60 * 60;
const LEASE_MS = 2 * 60 * 1_000;

export interface StoredIndexNowResult {
  ok: boolean;
  statusCode: number;
  message: string;
  submittedUrls: number;
}

type Claim =
  | { status: "owner"; token: string; payloadDigest: string }
  | { status: "completed"; result: StoredIndexNowResult }
  | { status: "busy" | "dispatched" | "conflict" | "rate-limited" | "unavailable" };

const CLAIM_SCRIPT = `
local existingRaw = redis.call("GET", KEYS[1])
if existingRaw then
  local ok, existing = pcall(cjson.decode, existingRaw)
  if not ok or existing.payloadDigest ~= ARGV[1] then return {-1, existingRaw} end
  if existing.status == "completed" then return {0, existingRaw} end
  if existing.status == "dispatched" then return {2, existingRaw} end
  if tonumber(existing.leaseExpiresAt or 0) > tonumber(ARGV[2]) then
    return {3, existingRaw}
  end
  existing.status = "claimed"
  existing.ownerTokenHash = ARGV[3]
  existing.leaseExpiresAt = tonumber(ARGV[4])
  existing.updatedAt = ARGV[5]
  local resumed = cjson.encode(existing)
  redis.call("SET", KEYS[1], resumed, "EX", tonumber(ARGV[6]))
  return {1, resumed}
end

local callerCount = redis.call("INCR", KEYS[2])
if callerCount == 1 then redis.call("EXPIRE", KEYS[2], tonumber(ARGV[7])) end
local globalCount = redis.call("INCR", KEYS[3])
if globalCount == 1 then redis.call("EXPIRE", KEYS[3], tonumber(ARGV[7])) end
if callerCount > tonumber(ARGV[8]) or globalCount > tonumber(ARGV[9]) then
  return {-3, ""}
end
redis.call("SET", KEYS[1], ARGV[10], "EX", tonumber(ARGV[6]))
return {1, ARGV[10]}
`;

const DISPATCH_SCRIPT = `
local raw = redis.call("GET", KEYS[1])
if not raw then return 0 end
local record = cjson.decode(raw)
if record.payloadDigest ~= ARGV[1] or record.status ~= "claimed"
  or record.ownerTokenHash ~= ARGV[2] then return 0 end
record.status = "dispatched"
record.updatedAt = ARGV[3]
record.leaseExpiresAt = nil
redis.call("SET", KEYS[1], cjson.encode(record), "EX", tonumber(ARGV[4]))
return 1
`;

const COMPLETE_SCRIPT = `
local raw = redis.call("GET", KEYS[1])
if not raw then return 0 end
local record = cjson.decode(raw)
if record.payloadDigest ~= ARGV[1] or record.status ~= "dispatched"
  or record.ownerTokenHash ~= ARGV[2] then return 0 end
record.status = "completed"
record.result = cjson.decode(ARGV[3])
record.updatedAt = ARGV[4]
redis.call("SET", KEYS[1], cjson.encode(record), "EX", tonumber(ARGV[5]))
return 1
`;

async function command<T>(parts: unknown[]): Promise<T> {
  if (!KV_URL || !KV_TOKEN) throw new Error("IndexNow ledger is unavailable.");
  const response = await fetch(KV_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${KV_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(parts),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("IndexNow ledger command failed.");
  const payload = (await response.json()) as { result?: T; error?: string };
  if (payload.error) throw new Error("IndexNow ledger command failed.");
  return payload.result as T;
}

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function recordKey(idempotencyKey: string): string {
  return `news:indexnow:v2:${digest(idempotencyKey)}`;
}

function parseRecord(raw: unknown): {
  result?: StoredIndexNowResult;
} | null {
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    return parsed && typeof parsed === "object"
      ? (parsed as { result?: StoredIndexNowResult })
      : null;
  } catch {
    return null;
  }
}

export function canonicalUrls(urls: string[]): string[] {
  return [...new Set(urls)].sort((a, b) => a.localeCompare(b, "en"));
}

export function urlsDigest(urls: string[]): string {
  return digest(JSON.stringify(canonicalUrls(urls)));
}

export async function claimIndexNow(
  idempotencyKey: string,
  urls: string[],
  callerIdentifier: string,
): Promise<Claim> {
  if (!KV_URL || !KV_TOKEN) return { status: "unavailable" };
  const payloadDigest = urlsDigest(urls);
  const token = randomBytes(32).toString("hex");
  const tokenHash = digest(token);
  const nowMs = Date.now();
  const now = new Date(nowMs).toISOString();
  const record = {
    payloadDigest,
    status: "claimed",
    ownerTokenHash: tokenHash,
    leaseExpiresAt: nowMs + LEASE_MS,
    createdAt: now,
    updatedAt: now,
  };
  const bucket = Math.floor(nowMs / (60 * 60 * 1_000));
  try {
    const result = await command<[number | string, unknown]>([
      "EVAL",
      CLAIM_SCRIPT,
      3,
      recordKey(idempotencyKey),
      `news:indexnow:caller:${digest(callerIdentifier)}:${bucket}`,
      `news:indexnow:global:${bucket}`,
      payloadDigest,
      String(nowMs),
      tokenHash,
      String(nowMs + LEASE_MS),
      now,
      String(TTL_SECONDS),
      String(60 * 60),
      "4",
      "20",
      JSON.stringify(record),
    ]);
    const code = Number(result?.[0]);
    if (code === -1) return { status: "conflict" };
    if (code === -3) return { status: "rate-limited" };
    if (code === 2) return { status: "dispatched" };
    if (code === 3) return { status: "busy" };
    if (code === 0) {
      const current = parseRecord(result?.[1]);
      return current?.result
        ? { status: "completed", result: current.result }
        : { status: "busy" };
    }
    return code === 1
      ? { status: "owner", token, payloadDigest }
      : { status: "unavailable" };
  } catch {
    return { status: "unavailable" };
  }
}

export async function markIndexNowDispatched(
  idempotencyKey: string,
  payloadDigest: string,
  token: string,
): Promise<boolean> {
  try {
    return (
      Number(
        await command<number>([
          "EVAL",
          DISPATCH_SCRIPT,
          1,
          recordKey(idempotencyKey),
          payloadDigest,
          digest(token),
          new Date().toISOString(),
          String(TTL_SECONDS),
        ]),
      ) === 1
    );
  } catch {
    return false;
  }
}

export async function completeIndexNow(
  idempotencyKey: string,
  payloadDigest: string,
  token: string,
  result: StoredIndexNowResult,
): Promise<boolean> {
  try {
    return (
      Number(
        await command<number>([
          "EVAL",
          COMPLETE_SCRIPT,
          1,
          recordKey(idempotencyKey),
          payloadDigest,
          digest(token),
          JSON.stringify(result),
          new Date().toISOString(),
          String(TTL_SECONDS),
        ]),
      ) === 1
    );
  } catch {
    return false;
  }
}
