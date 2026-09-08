import { createHash, randomBytes } from "node:crypto";

import {
  NEWS_WORKFLOW_FILE,
  NEWS_WORKFLOW_REF,
  type MorningDispatchClaim,
  type MorningDispatchLedger,
  type MorningDispatchResult,
} from "./types";

const TTL_SECONDS = 14 * 24 * 60 * 60;
const LEASE_MS = 2 * 60 * 1_000;

type SchedulerEnvironment = Readonly<Record<string, string | undefined>>;
type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

const CLAIM_SCRIPT = `
local raw = redis.call("GET", KEYS[1])
if raw then
  local ok, current = pcall(cjson.decode, raw)
  if not ok or current.payloadDigest ~= ARGV[1] then return {-1, raw} end
  if current.status == "completed" then return {0, raw} end
  if current.status == "dispatched" then return {2, raw} end
  if current.status == "retryable" then
    current.status = "claimed"
    current.ownerTokenHash = ARGV[3]
    current.leaseExpiresAt = tonumber(ARGV[4])
    current.updatedAt = ARGV[5]
    local retried = cjson.encode(current)
    redis.call("SET", KEYS[1], retried, "EX", tonumber(ARGV[6]))
    return {1, retried}
  end
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

const RETRYABLE_SCRIPT = `
local raw = redis.call("GET", KEYS[1])
if not raw then return 0 end
local current = cjson.decode(raw)
if current.payloadDigest ~= ARGV[1] or current.status ~= "dispatched"
  or current.ownerTokenHash ~= ARGV[2] then return 0 end
current.status = "retryable"
current.failureCode = ARGV[3]
current.updatedAt = ARGV[4]
current.leaseExpiresAt = nil
redis.call("SET", KEYS[1], cjson.encode(current), "EX", tonumber(ARGV[5]))
return 1
`;

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function morningDispatchPayloadDigest(morningDate: string): string {
  return digest(
    JSON.stringify({
      morningDate,
      workflow: NEWS_WORKFLOW_FILE,
      ref: NEWS_WORKFLOW_REF,
    }),
  );
}

function recordKey(morningDate: string): string {
  return `news:scheduler:watchdog:v1:${morningDate}`;
}

function parseCompletedResult(raw: unknown): MorningDispatchResult | null {
  try {
    const value = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!value || typeof value !== "object") return null;
    const result = (value as { result?: MorningDispatchResult }).result;
    return result?.completedAt ? result : null;
  } catch {
    return null;
  }
}

export function schedulerLedgerConfigured(
  environment: SchedulerEnvironment = process.env,
): boolean {
  return Boolean(
    environment.KV_REST_API_URL?.trim() &&
      environment.KV_REST_API_TOKEN?.trim(),
  );
}

export class KvMorningDispatchLedger implements MorningDispatchLedger {
  private readonly url: string;
  private readonly credential: string;
  private readonly fetcher: Fetcher;

  constructor(
    environment: SchedulerEnvironment = process.env,
    fetcher: Fetcher = fetch,
  ) {
    this.url = environment.KV_REST_API_URL?.trim() ?? "";
    this.credential = environment.KV_REST_API_TOKEN?.trim() ?? "";
    this.fetcher = fetcher;
  }

  private async command<T>(parts: unknown[]): Promise<T> {
    if (!this.url || !this.credential) {
      throw new Error("Morning dispatch ledger is unavailable.");
    }
    const response = await this.fetcher(this.url, {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.credential}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(parts),
      cache: "no-store",
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) {
      throw new Error("Morning dispatch ledger command failed.");
    }
    const payload = (await response.json().catch(() => null)) as {
      result?: T;
      error?: unknown;
    } | null;
    if (!payload || payload.error !== undefined) {
      throw new Error("Morning dispatch ledger command failed.");
    }
    return payload.result as T;
  }

  async claim(morningDate: string): Promise<MorningDispatchClaim> {
    const payloadDigest = morningDispatchPayloadDigest(morningDate);
    const token = randomBytes(32).toString("hex");
    const ownerTokenHash = digest(token);
    const nowMs = Date.now();
    const now = new Date(nowMs).toISOString();
    const record = {
      morningDate,
      payloadDigest,
      status: "claimed",
      ownerTokenHash,
      leaseExpiresAt: nowMs + LEASE_MS,
      createdAt: now,
      updatedAt: now,
    };

    try {
      const response = await this.command<[number | string, unknown]>([
        "EVAL",
        CLAIM_SCRIPT,
        1,
        recordKey(morningDate),
        payloadDigest,
        String(nowMs),
        ownerTokenHash,
        String(nowMs + LEASE_MS),
        now,
        String(TTL_SECONDS),
        JSON.stringify(record),
      ]);
      const code = Number(response?.[0]);
      if (code === -1) return { status: "conflict" };
      if (code === 2) return { status: "dispatched" };
      if (code === 3) return { status: "busy" };
      if (code === 0) {
        const result = parseCompletedResult(response?.[1]);
        return result
          ? { status: "completed", result }
          : { status: "unavailable" };
      }
      return code === 1
        ? { status: "owner", token, payloadDigest }
        : { status: "unavailable" };
    } catch {
      return { status: "unavailable" };
    }
  }

  async markDispatched(
    morningDate: string,
    payloadDigest: string,
    token: string,
  ): Promise<boolean> {
    try {
      return (
        Number(
          await this.command<number>([
            "EVAL",
            DISPATCH_SCRIPT,
            1,
            recordKey(morningDate),
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

  async complete(
    morningDate: string,
    payloadDigest: string,
    token: string,
    result: MorningDispatchResult,
  ): Promise<boolean> {
    try {
      return (
        Number(
          await this.command<number>([
            "EVAL",
            COMPLETE_SCRIPT,
            1,
            recordKey(morningDate),
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

  async markRetryable(
    morningDate: string,
    payloadDigest: string,
    token: string,
    failureCode: string,
  ): Promise<boolean> {
    try {
      return (
        Number(
          await this.command<number>([
            "EVAL",
            RETRYABLE_SCRIPT,
            1,
            recordKey(morningDate),
            payloadDigest,
            digest(token),
            failureCode.replace(/[^a-z0-9-]/giu, "-").slice(0, 64),
            new Date().toISOString(),
            String(TTL_SECONDS),
          ]),
        ) === 1
      );
    } catch {
      return false;
    }
  }
}
