// Approval Queue storage.
//
// Production keeps the compatible array representation, but every mutation is
// one Redis Lua transaction. Local development serializes mutations and uses
// an atomic file replacement.

import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type { QueueItem, QueueStatus, QueueChannel } from "./types";
import { calculateExpiresAt } from "./types";

const QUEUE_FILE = path.join(process.cwd(), "pipeline-runs", "queue.json");
const QUEUE_IDEMPOTENCY_DIR = path.join(
  process.cwd(),
  "pipeline-runs",
  "queue-idempotency",
);
const KV_URL = process.env.KV_REST_API_URL?.trim() ?? "";
const KV_TOKEN = process.env.KV_REST_API_TOKEN?.trim() ?? "";
const KV_KEY = "iwr:queue:items";
const MAX_QUEUE_ITEMS = 10_000;
const ADD_IDEMPOTENCY_TTL_SECONDS = 24 * 60 * 60;
const TERMINAL_RETENTION_MS = 30 * 24 * 60 * 60 * 1_000;

type QueuePartial = Omit<
  QueueItem,
  "id" | "recordVersion" | "createdAt" | "expiresAt" | "status"
>;

export class QueueMutationConflictError extends Error {
  constructor() {
    super("This queue item changed in another session. Refresh and retry.");
    this.name = "QueueMutationConflictError";
  }
}

function hasKv(): boolean {
  return Boolean(KV_URL && KV_TOKEN);
}

function requireDurableProductionStorage(): void {
  if (process.env.NODE_ENV === "production" && !hasKv()) {
    throw new Error("Durable queue storage is required in production.");
  }
}

function normalizeItems(value: unknown): QueueItem[] {
  if (!Array.isArray(value)) {
    throw new Error("Queue storage returned an invalid payload.");
  }
  return value.map((candidate) => {
    const item = candidate as QueueItem;
    return {
      ...item,
      recordVersion:
        Number.isSafeInteger(item.recordVersion) && item.recordVersion > 0
          ? item.recordVersion
          : 1,
    };
  });
}

async function kvCommand<T>(command: unknown[]): Promise<T> {
  requireDurableProductionStorage();
  if (!hasKv()) throw new Error("Queue KV is not configured.");
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
    throw new Error(`Queue storage command failed (${response.status}).`);
  }
  const payload = (await response.json()) as {
    result?: T;
    error?: string;
  };
  if (
    payload.error ||
    !Object.prototype.hasOwnProperty.call(payload, "result")
  ) {
    throw new Error("Queue storage rejected the command.");
  }
  return payload.result as T;
}

async function kvGet(): Promise<QueueItem[]> {
  const raw = await kvCommand<unknown>(["GET", KV_KEY]);
  if (raw === null || raw === undefined) return [];
  return normalizeItems(typeof raw === "string" ? JSON.parse(raw) : raw);
}

const ADD_ITEMS_SCRIPT = `
local existing = redis.call("GET", KEYS[2])
if existing then
  local record = cjson.decode(existing)
  if record.payloadDigest ~= ARGV[3] then return {-2, ""} end
  return {0, cjson.encode(record.created)}
end
local raw = redis.call("GET", KEYS[1])
local items = raw and cjson.decode(raw) or {}
for index = #items, 1, -1 do
  local item = items[index]
  local terminal = item.status == "posted" or item.status == "skipped" or item.status == "expired"
  if terminal and item.actedAt and tostring(item.actedAt) < ARGV[6] then
    table.remove(items, index)
  end
end
local created = cjson.decode(ARGV[1])
if (#items + #created) > tonumber(ARGV[2]) then return {-1, ""} end
for _, item in ipairs(created) do table.insert(items, item) end
redis.call("SET", KEYS[1], cjson.encode(items))
redis.call("SET", KEYS[2], ARGV[4], "EX", tonumber(ARGV[5]))
return {1, cjson.encode(created)}
`;

const UPDATE_ITEM_SCRIPT = `
local raw = redis.call("GET", KEYS[1])
if not raw then return {-2, ""} end
local items = cjson.decode(raw)
for index, item in ipairs(items) do
  if item.id == ARGV[1] then
    local version = tonumber(item.recordVersion or 1)
    if version ~= tonumber(ARGV[2]) then return {-1, cjson.encode(item)} end
    local patch = cjson.decode(ARGV[3])
    for key, value in pairs(patch) do
      if key ~= "id" and key ~= "createdAt" and key ~= "recordVersion" then
        item[key] = value
      end
    end
    item.recordVersion = version + 1
    items[index] = item
    redis.call("SET", KEYS[1], cjson.encode(items))
    return {1, cjson.encode(item)}
  end
end
return {-2, ""}
`;

const DELETE_ITEM_SCRIPT = `
local raw = redis.call("GET", KEYS[1])
if not raw then return {-2, ""} end
local items = cjson.decode(raw)
for index, item in ipairs(items) do
  if item.id == ARGV[1] then
    if tonumber(item.recordVersion or 1) ~= tonumber(ARGV[2]) then
      return {-1, cjson.encode(item)}
    end
    table.remove(items, index)
    redis.call("SET", KEYS[1], cjson.encode(items))
    return {1, cjson.encode(item)}
  end
end
return {-2, ""}
`;

const EXPIRE_ITEMS_SCRIPT = `
local raw = redis.call("GET", KEYS[1])
if not raw then return 0 end
local items = cjson.decode(raw)
local count = 0
for index, item in ipairs(items) do
  if (item.status == "pending" or item.status == "edited")
    and tostring(item.expiresAt or "") < ARGV[1] then
    item.status = "expired"
    item.actedAt = ARGV[1]
    item.recordVersion = tonumber(item.recordVersion or 1) + 1
    items[index] = item
    count = count + 1
  end
end
if count > 0 then redis.call("SET", KEYS[1], cjson.encode(items)) end
return count
`;

async function fsGet(): Promise<QueueItem[]> {
  try {
    const raw = await fs.readFile(QUEUE_FILE, "utf-8");
    return normalizeItems(JSON.parse(raw));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

async function fsSet(items: QueueItem[]): Promise<void> {
  await fs.mkdir(path.dirname(QUEUE_FILE), { recursive: true });
  const temporary = `${QUEUE_FILE}.${process.pid}.${crypto.randomUUID()}.tmp`;
  await fs.writeFile(temporary, JSON.stringify(items, null, 2), "utf-8");
  await fs.rename(temporary, QUEUE_FILE);
}

let fsMutationChain: Promise<unknown> = Promise.resolve();
function withFsMutation<T>(mutation: () => Promise<T>): Promise<T> {
  const result = fsMutationChain.then(mutation, mutation);
  fsMutationChain = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

export async function getAllItems(): Promise<QueueItem[]> {
  requireDurableProductionStorage();
  return hasKv() ? kvGet() : fsGet();
}

export async function getItemsByStatus(status: QueueStatus): Promise<QueueItem[]> {
  return (await getAllItems()).filter((item) => item.status === status);
}

export async function getPendingItems(): Promise<QueueItem[]> {
  return (await getAllItems())
    .filter((item) => item.status === "pending" || item.status === "edited")
    .sort((a, b) => a.expiresAt.localeCompare(b.expiresAt));
}

export async function getItem(id: string): Promise<QueueItem | null> {
  return (await getAllItems()).find((item) => item.id === id) ?? null;
}

function createItems(partials: QueuePartial[]): QueueItem[] {
  const now = new Date();
  return partials.map((partial) => ({
    ...partial,
    id: crypto.randomUUID(),
    recordVersion: 1,
    createdAt: now.toISOString(),
    expiresAt: calculateExpiresAt(partial.channel, now),
    status: "pending" as const,
  }));
}

export async function addItem(partial: QueuePartial): Promise<QueueItem> {
  return (await addItems([partial], crypto.randomUUID()))[0];
}

export async function addItems(
  partials: QueuePartial[],
  idempotencyKey: string,
): Promise<QueueItem[]> {
  if (!/^[A-Za-z0-9._:-]{8,128}$/.test(idempotencyKey)) {
    throw new Error("A valid queue idempotency key is required.");
  }
  const payloadDigest = crypto
    .createHash("sha256")
    .update(JSON.stringify(partials))
    .digest("hex");
  const created = createItems(partials);
  const reservation = { payloadDigest, created };
  const reservationKey = `iwr:queue:add:${crypto
    .createHash("sha256")
    .update(idempotencyKey)
    .digest("hex")}`;
  const retentionCutoff = new Date(
    Date.now() - TERMINAL_RETENTION_MS,
  ).toISOString();
  if (hasKv()) {
    const result = await kvCommand<[number | string, string]>([
      "EVAL",
      ADD_ITEMS_SCRIPT,
      2,
      KV_KEY,
      reservationKey,
      JSON.stringify(created),
      String(MAX_QUEUE_ITEMS),
      payloadDigest,
      JSON.stringify(reservation),
      String(ADD_IDEMPOTENCY_TTL_SECONDS),
      retentionCutoff,
    ]);
    const code = Number(result?.[0]);
    if (code === -2) {
      throw new QueueMutationConflictError();
    }
    if (code !== 0 && code !== 1) {
      throw new Error("The outreach queue has reached its safety limit.");
    }
    return normalizeItems(JSON.parse(String(result[1])));
  }
  requireDurableProductionStorage();
  return withFsMutation(async () => {
    const idempotencyFile = path.join(
      QUEUE_IDEMPOTENCY_DIR,
      `${crypto.createHash("sha256").update(idempotencyKey).digest("hex")}.json`,
    );
    try {
      const existing = JSON.parse(
        await fs.readFile(idempotencyFile, "utf8"),
      ) as {
        payloadDigest?: string;
        created?: unknown;
        expiresAt?: string;
      };
      if (
        existing.expiresAt &&
        existing.expiresAt > new Date().toISOString()
      ) {
        if (existing.payloadDigest !== payloadDigest) {
          throw new QueueMutationConflictError();
        }
        return normalizeItems(existing.created);
      }
    } catch (error) {
      if (
        error instanceof QueueMutationConflictError ||
        (error as NodeJS.ErrnoException).code !== "ENOENT"
      ) {
        throw error;
      }
    }
    const all = (await fsGet()).filter(
      (item) =>
        !(
          (item.status === "posted" ||
            item.status === "skipped" ||
            item.status === "expired") &&
          item.actedAt &&
          item.actedAt < retentionCutoff
        ),
    );
    if (all.length + created.length > MAX_QUEUE_ITEMS) {
      throw new Error("The outreach queue has reached its safety limit.");
    }
    await fsSet([...all, ...created]);
    await fs.mkdir(QUEUE_IDEMPOTENCY_DIR, { recursive: true });
    await fs.writeFile(
      idempotencyFile,
      JSON.stringify(
        {
          payloadDigest,
          created,
          expiresAt: new Date(
            Date.now() + ADD_IDEMPOTENCY_TTL_SECONDS * 1_000,
          ).toISOString(),
        },
        null,
        2,
      ),
      "utf8",
    );
    return created;
  });
}

export async function updateItem(
  id: string,
  expectedRecordVersion: number,
  patch: Partial<QueueItem>,
): Promise<QueueItem | null> {
  if (hasKv()) {
    const result = await kvCommand<[number | string, unknown]>([
      "EVAL",
      UPDATE_ITEM_SCRIPT,
      1,
      KV_KEY,
      id,
      String(expectedRecordVersion),
      JSON.stringify(patch),
    ]);
    const code = Number(result?.[0]);
    if (code === -1) throw new QueueMutationConflictError();
    return code === 1
      ? normalizeItems([JSON.parse(String(result[1]))])[0]
      : null;
  }
  requireDurableProductionStorage();
  return withFsMutation(async () => {
    const all = await fsGet();
    const index = all.findIndex((item) => item.id === id);
    if (index < 0) return null;
    if (all[index].recordVersion !== expectedRecordVersion) {
      throw new QueueMutationConflictError();
    }
    const current = all[index];
    const updated: QueueItem = {
      ...current,
      ...patch,
      id: current.id,
      createdAt: current.createdAt,
      recordVersion: current.recordVersion + 1,
    };
    all[index] = updated;
    await fsSet(all);
    return updated;
  });
}

export async function deleteItem(
  id: string,
  expectedRecordVersion: number,
): Promise<boolean> {
  if (hasKv()) {
    const result = await kvCommand<[number | string, unknown]>([
      "EVAL",
      DELETE_ITEM_SCRIPT,
      1,
      KV_KEY,
      id,
      String(expectedRecordVersion),
    ]);
    const code = Number(result?.[0]);
    if (code === -1) throw new QueueMutationConflictError();
    return code === 1;
  }
  requireDurableProductionStorage();
  return withFsMutation(async () => {
    const all = await fsGet();
    const index = all.findIndex((item) => item.id === id);
    if (index < 0) return false;
    if (all[index].recordVersion !== expectedRecordVersion) {
      throw new QueueMutationConflictError();
    }
    all.splice(index, 1);
    await fsSet(all);
    return true;
  });
}

export async function expireStaleItems(now = new Date()): Promise<number> {
  const timestamp = now.toISOString();
  if (hasKv()) {
    return Number(
      await kvCommand<number>([
        "EVAL",
        EXPIRE_ITEMS_SCRIPT,
        1,
        KV_KEY,
        timestamp,
      ]),
    );
  }
  requireDurableProductionStorage();
  return withFsMutation(async () => {
    const all = await fsGet();
    let count = 0;
    for (const item of all) {
      if (
        (item.status === "pending" || item.status === "edited") &&
        item.expiresAt < timestamp
      ) {
        item.status = "expired";
        item.actedAt = timestamp;
        item.recordVersion += 1;
        count += 1;
      }
    }
    if (count > 0) await fsSet(all);
    return count;
  });
}

export async function getQueueStats(): Promise<{
  total: number;
  pending: number;
  approved: number;
  posted: number;
  skipped: number;
  expired: number;
  edited: number;
  byChannel: Record<QueueChannel, number>;
}> {
  const all = await getAllItems();
  const byChannel: Partial<Record<QueueChannel, number>> = {};
  for (const item of all) {
    byChannel[item.channel] = (byChannel[item.channel] ?? 0) + 1;
  }
  const count = (status: QueueStatus) =>
    all.filter((item) => item.status === status).length;
  return {
    total: all.length,
    pending: count("pending"),
    approved: count("approved"),
    posted: count("posted"),
    skipped: count("skipped"),
    expired: count("expired"),
    edited: count("edited"),
    byChannel: byChannel as Record<QueueChannel, number>,
  };
}

export function getStorageBackend(): "vercel-kv" | "file-system" {
  return hasKv() ? "vercel-kv" : "file-system";
}
