import { createHash, randomBytes } from "node:crypto";

const AUTOMATED_PUBLICATION_TTL_SECONDS = 14 * 24 * 60 * 60;
const AUTOMATED_PUBLICATION_LEASE_MS = 5 * 60 * 1_000;

type SchedulerEnvironment = Readonly<Record<string, string | undefined>>;
type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

export type AutomatedPublicationDayIdentity = Readonly<{
  morningDate: string;
  draftId: string;
  revision: number;
  contentHash: string;
}>;

export type AutomatedPublicationDayClaim =
  | Readonly<{
      status: "owner";
      payloadDigest: string;
      token: string;
    }>
  | Readonly<{
      status: "busy";
      payloadDigest: string;
    }>
  | Readonly<{
      status: "completed";
      payloadDigest: string;
    }>
  | Readonly<{
      status: "conflict";
      payloadDigest: string;
    }>
  | Readonly<{
      status: "unavailable";
      payloadDigest: string;
    }>;

export type AutomatedPublicationDayCommitStart =
  | "started"
  | "lost"
  | "unavailable";

export type AutomatedPublicationDayRelease =
  | "released"
  | "not-owner"
  | "unavailable";

export type AutomatedPublicationDayResult = Readonly<{
  draftId: string;
  slug: string;
  claimId: string;
  commitSha: string;
  url: string;
  completedAt: string;
}>;

const CLAIM_SCRIPT = `
local raw = redis.call("GET", KEYS[1])
if raw then
  local ok, current = pcall(cjson.decode, raw)
  if not ok or current.payloadDigest ~= ARGV[1] then return -1 end
  if current.status == "completed" then return 3 end
  if current.status == "committing" then return 2 end
  if current.status == "claimed"
    and tonumber(current.leaseExpiresAt or 0) > tonumber(ARGV[2]) then
    return 2
  end
  if current.status ~= "claimed" and current.status ~= "retryable" then
    return -1
  end
  current.status = "claimed"
  current.ownerTokenHash = ARGV[3]
  current.leaseExpiresAt = tonumber(ARGV[4])
  current.updatedAt = ARGV[5]
  local claimed = cjson.encode(current)
  redis.call("SET", KEYS[1], claimed, "EX", tonumber(ARGV[6]))
  return 1
end
redis.call("SET", KEYS[1], ARGV[7], "EX", tonumber(ARGV[6]))
return 1
`;

const START_COMMIT_SCRIPT = `
local raw = redis.call("GET", KEYS[1])
if not raw then return 0 end
local ok, current = pcall(cjson.decode, raw)
if not ok or current.payloadDigest ~= ARGV[1]
  or current.ownerTokenHash ~= ARGV[2] then return 0 end
if current.status == "committing" then return 2 end
if current.status ~= "claimed"
  or tonumber(current.leaseExpiresAt or 0) <= tonumber(ARGV[3]) then return 0 end
current.status = "committing"
current.updatedAt = ARGV[4]
current.leaseExpiresAt = nil
redis.call("SET", KEYS[1], cjson.encode(current), "EX", tonumber(ARGV[5]))
return 1
`;

const COMPLETE_SCRIPT = `
local raw = redis.call("GET", KEYS[1])
if not raw then return 0 end
local ok, current = pcall(cjson.decode, raw)
if not ok or current.payloadDigest ~= ARGV[1] then return 0 end
if current.status == "completed" then return 2 end
if current.status ~= "committing"
  or current.ownerTokenHash ~= ARGV[2] then return 0 end
current.status = "completed"
current.result = cjson.decode(ARGV[3])
current.updatedAt = ARGV[4]
current.ownerTokenHash = nil
redis.call("SET", KEYS[1], cjson.encode(current), "EX", tonumber(ARGV[5]))
return 1
`;

// This transition is safe only before publishArticleCommit is invoked. It also
// accepts a commit-start marker from the same owner so an uncertain Redis
// response can be cancelled while the caller still knows GitHub was untouched.
const RELEASE_BEFORE_COMMIT_SCRIPT = `
local raw = redis.call("GET", KEYS[1])
if not raw then return 0 end
local ok, current = pcall(cjson.decode, raw)
if not ok or current.payloadDigest ~= ARGV[1]
  or current.ownerTokenHash ~= ARGV[2]
  or (current.status ~= "claimed" and current.status ~= "committing") then
  return 0
end
current.status = "retryable"
current.failureCode = ARGV[3]
current.updatedAt = ARGV[4]
current.ownerTokenHash = nil
current.leaseExpiresAt = nil
redis.call("SET", KEYS[1], cjson.encode(current), "EX", tonumber(ARGV[5]))
return 1
`;

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function automatedPublicationDayPayloadDigest(
  identity: AutomatedPublicationDayIdentity,
): string {
  return digest(JSON.stringify(identity));
}

export function automatedPublicationDayKey(morningDate: string): string {
  return `news:scheduler:publication-day:v1:${morningDate}`;
}

export function automatedPublicationDayLedgerConfigured(
  environment: SchedulerEnvironment = process.env,
): boolean {
  return Boolean(
    environment.KV_REST_API_URL?.trim() &&
      environment.KV_REST_API_TOKEN?.trim(),
  );
}

export class KvAutomatedPublicationDayLedger {
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

  private async command(parts: unknown[]): Promise<unknown> {
    if (!this.url || !this.credential) {
      throw new Error("Automated publication day ledger is unavailable.");
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
      throw new Error("Automated publication day ledger command failed.");
    }
    const payload = (await response.json().catch(() => null)) as {
      result?: unknown;
      error?: unknown;
    } | null;
    if (!payload || payload.error !== undefined) {
      throw new Error("Automated publication day ledger command failed.");
    }
    return payload.result;
  }

  async claim(
    identity: AutomatedPublicationDayIdentity,
  ): Promise<AutomatedPublicationDayClaim> {
    const payloadDigest = automatedPublicationDayPayloadDigest(identity);
    const token = randomBytes(32).toString("hex");
    const ownerTokenHash = digest(token);
    const nowMs = Date.now();
    const now = new Date(nowMs).toISOString();
    const record = {
      morningDate: identity.morningDate,
      payloadDigest,
      status: "claimed",
      ownerTokenHash,
      leaseExpiresAt: nowMs + AUTOMATED_PUBLICATION_LEASE_MS,
      createdAt: now,
      updatedAt: now,
    };
    try {
      const result = Number(
        await this.command([
          "EVAL",
          CLAIM_SCRIPT,
          1,
          automatedPublicationDayKey(identity.morningDate),
          payloadDigest,
          String(nowMs),
          ownerTokenHash,
          String(nowMs + AUTOMATED_PUBLICATION_LEASE_MS),
          now,
          String(AUTOMATED_PUBLICATION_TTL_SECONDS),
          JSON.stringify(record),
        ]),
      );
      if (result === 1) return { status: "owner", payloadDigest, token };
      if (result === 2) return { status: "busy", payloadDigest };
      if (result === 3) return { status: "completed", payloadDigest };
      if (result === 0 || result === -1) {
        return { status: "conflict", payloadDigest };
      }
      return { status: "unavailable", payloadDigest };
    } catch {
      return { status: "unavailable", payloadDigest };
    }
  }

  async markCommitStarted(
    identity: AutomatedPublicationDayIdentity,
    token: string,
  ): Promise<AutomatedPublicationDayCommitStart> {
    const payloadDigest = automatedPublicationDayPayloadDigest(identity);
    const nowMs = Date.now();
    try {
      const code = Number(
        await this.command([
          "EVAL",
          START_COMMIT_SCRIPT,
          1,
          automatedPublicationDayKey(identity.morningDate),
          payloadDigest,
          digest(token),
          String(nowMs),
          new Date(nowMs).toISOString(),
          String(AUTOMATED_PUBLICATION_TTL_SECONDS),
        ]),
      );
      if (code === 1 || code === 2) return "started";
      return "lost";
    } catch {
      return "unavailable";
    }
  }

  async releaseBeforeCommit(
    identity: AutomatedPublicationDayIdentity,
    token: string,
    failureCode: string,
  ): Promise<AutomatedPublicationDayRelease> {
    const payloadDigest = automatedPublicationDayPayloadDigest(identity);
    try {
      const code = Number(
        await this.command([
          "EVAL",
          RELEASE_BEFORE_COMMIT_SCRIPT,
          1,
          automatedPublicationDayKey(identity.morningDate),
          payloadDigest,
          digest(token),
          failureCode.replace(/[^a-z0-9-]/giu, "-").slice(0, 64),
          new Date().toISOString(),
          String(AUTOMATED_PUBLICATION_TTL_SECONDS),
        ]),
      );
      return code === 1 ? "released" : "not-owner";
    } catch {
      return "unavailable";
    }
  }

  async complete(
    identity: AutomatedPublicationDayIdentity,
    token: string,
    result: AutomatedPublicationDayResult,
  ): Promise<boolean> {
    const payloadDigest = automatedPublicationDayPayloadDigest(identity);
    try {
      const code = Number(
        await this.command([
          "EVAL",
          COMPLETE_SCRIPT,
          1,
          automatedPublicationDayKey(identity.morningDate),
          payloadDigest,
          digest(token),
          JSON.stringify(result),
          result.completedAt,
          String(AUTOMATED_PUBLICATION_TTL_SECONDS),
        ]),
      );
      return code === 1 || code === 2;
    } catch {
      return false;
    }
  }
}
