import { createHash, randomBytes } from "node:crypto";

import type { Channel, DistributionRun } from "./types";

const KV_URL = process.env.KV_REST_API_URL?.trim() ?? "";
const KV_TOKEN = process.env.KV_REST_API_TOKEN?.trim() ?? "";
const TTL_SECONDS = 7 * 24 * 60 * 60;
const LEASE_MS = 2 * 60 * 1_000;

export function isDistributionLedgerConfigured(): boolean {
  return Boolean(KV_URL && KV_TOKEN);
}

export type DistributionOperationResult = Readonly<{
  ok: boolean;
  articleSlugs: string[];
  channels: Channel[];
  runs: DistributionRun[];
  completedAt: string;
}>;

type Claim =
  | { status: "owner"; token: string; payloadDigest: string }
  | { status: "completed"; result: DistributionOperationResult }
  | { status: "busy" | "dispatched" | "conflict" | "unavailable" };

const CLAIM_SCRIPT = `
local raw = redis.call("GET", KEYS[1])
if raw then
  local ok, current = pcall(cjson.decode, raw)
  if not ok or current.payloadDigest ~= ARGV[1] then return {-1, raw} end
  if current.status == "completed" then return {0, raw} end
  if current.status == "dispatched" then return {2, raw} end
  if tonumber(current.leaseExpiresAt or 0) > tonumber(ARGV[2]) then return {3, raw} end
  current.status = "claimed"
  current.ownerTokenHash = ARGV[3]
  current.leaseExpiresAt = tonumber(ARGV[4])
  current.updatedAt = ARGV[5]
  local resumed = cjson.encode(current)
  redis.call("SET", KEYS[1], resumed, "EX", tonumber(ARGV[6]))
  return {1, resumed}
end
redis.call("SET", KEYS[1], ARGV[7], "EX", tonumber(ARGV[6]))
return {1, ARGV[7]}
`;

const DISPATCH_SCRIPT = `
local raw = redis.call("GET", KEYS[1])
if not raw then return 0 end
local current = cjson.decode(raw)
if current.payloadDigest ~= ARGV[1] or current.status ~= "claimed"
  or current.ownerTokenHash ~= ARGV[2] then return 0 end
current.status = "dispatched"
current.updatedAt = ARGV[3]
current.leaseExpiresAt = nil
redis.call("SET", KEYS[1], cjson.encode(current), "EX", tonumber(ARGV[4]))
return 1
`;

const COMPLETE_SCRIPT = `
local raw = redis.call("GET", KEYS[1])
if not raw then return 0 end
local current = cjson.decode(raw)
if current.payloadDigest ~= ARGV[1] or current.status ~= "dispatched"
  or current.ownerTokenHash ~= ARGV[2] then return 0 end
current.status = "completed"
current.result = cjson.decode(ARGV[3])
current.updatedAt = ARGV[4]
redis.call("SET", KEYS[1], cjson.encode(current), "EX", tonumber(ARGV[5]))
return 1
`;

async function command<T>(parts: unknown[]): Promise<T> {
  if (!KV_URL || !KV_TOKEN) throw new Error("Distribution ledger unavailable.");
  const response = await fetch(KV_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${KV_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(parts),
    cache: "no-store",
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) throw new Error("Distribution ledger command failed.");
  const payload = (await response.json()) as { result?: T; error?: string };
  if (payload.error) throw new Error("Distribution ledger command failed.");
  return payload.result as T;
}

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function recordKey(idempotencyKey: string): string {
  return `news:distribution:v1:${digest(idempotencyKey)}`;
}

export function distributionPayloadDigest(
  articleSlugs: readonly string[],
  channels: readonly Channel[],
): string {
  return digest(
    JSON.stringify({
      articleSlugs: [...new Set(articleSlugs)].sort(),
      channels: [...new Set(channels)].sort(),
    }),
  );
}

function parseResult(raw: unknown): DistributionOperationResult | null {
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!parsed || typeof parsed !== "object") return null;
    const result = (parsed as { result?: DistributionOperationResult }).result;
    return result?.completedAt ? result : null;
  } catch {
    return null;
  }
}

export async function claimDistributionOperation(
  idempotencyKey: string,
  articleSlugs: readonly string[],
  channels: readonly Channel[],
): Promise<Claim> {
  if (!KV_URL || !KV_TOKEN) return { status: "unavailable" };
  const payloadDigest = distributionPayloadDigest(articleSlugs, channels);
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

  try {
    const response = await command<[number | string, unknown]>([
      "EVAL",
      CLAIM_SCRIPT,
      1,
      recordKey(idempotencyKey),
      payloadDigest,
      String(nowMs),
      tokenHash,
      String(nowMs + LEASE_MS),
      now,
      String(TTL_SECONDS),
      JSON.stringify(record),
    ]);
    const code = Number(response?.[0]);
    if (code === -1) return { status: "conflict" };
    if (code === 0) {
      const result = parseResult(response?.[1]);
      return result ? { status: "completed", result } : { status: "busy" };
    }
    if (code === 2) return { status: "dispatched" };
    if (code === 3) return { status: "busy" };
    return code === 1
      ? { status: "owner", token, payloadDigest }
      : { status: "unavailable" };
  } catch {
    return { status: "unavailable" };
  }
}

export async function markDistributionDispatched(
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

export async function completeDistributionOperation(
  idempotencyKey: string,
  payloadDigest: string,
  token: string,
  result: DistributionOperationResult,
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
          result.completedAt,
          String(TTL_SECONDS),
        ]),
      ) === 1
    );
  } catch {
    return false;
  }
}
