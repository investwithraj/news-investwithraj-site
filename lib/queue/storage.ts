// Approval Queue storage layer.
//
// Two adapters, swapped automatically by runtime:
//   - File-system (dev / local CLI): pipeline-runs/queue.json
//   - Vercel KV (production):       set KV_REST_API_URL + KV_REST_API_TOKEN
//
// In production on Vercel, file-system writes are ephemeral (lost on next
// cold start), so KV is required when running there. Locally KV is optional
// — file-system fallback is fine for solo dev.

import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type { QueueItem, QueueStatus, QueueChannel } from "./types";
import { calculateExpiresAt } from "./types";

const QUEUE_FILE = path.join(process.cwd(), "pipeline-runs", "queue.json");

const KV_URL = process.env.KV_REST_API_URL || "";
const KV_TOKEN = process.env.KV_REST_API_TOKEN || "";
const KV_KEY = "iwr:queue:items";

function useKv(): boolean {
  return Boolean(KV_URL && KV_TOKEN);
}

// ------------------------------------------------------------------
// KV adapter — Upstash-compatible REST API (Vercel KV / Redis Cloud)
// ------------------------------------------------------------------

async function kvGet(): Promise<QueueItem[]> {
  try {
    const res = await fetch(`${KV_URL}/get/${KV_KEY}`, {
      headers: { Authorization: `Bearer ${KV_TOKEN}` },
      cache: "no-store",
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { result?: unknown };
    // Upstash returns the stored value as `result`. We stored a JSON-stringified
    // array, so result should be a string. Be defensive — also accept arrays
    // returned directly (some Upstash plan tiers auto-decode JSON content).
    if (data.result == null) return [];
    if (Array.isArray(data.result)) return data.result as QueueItem[];
    if (typeof data.result === "string") {
      try {
        const parsed = JSON.parse(data.result);
        return Array.isArray(parsed) ? (parsed as QueueItem[]) : [];
      } catch {
        return [];
      }
    }
    return [];
  } catch {
    return [];
  }
}

async function kvSet(items: QueueItem[]): Promise<boolean> {
  try {
    // Upstash REST: POST /set/<key> with body = raw value.
    // We send a single-stringified JSON array as text/plain so it round-trips
    // correctly through the `result` field on GET.
    const res = await fetch(`${KV_URL}/set/${KV_KEY}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${KV_TOKEN}`,
        "Content-Type": "text/plain",
      },
      body: JSON.stringify(items),
      cache: "no-store",
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ------------------------------------------------------------------
// File-system adapter
// ------------------------------------------------------------------

async function fsGet(): Promise<QueueItem[]> {
  try {
    const raw = await fs.readFile(QUEUE_FILE, "utf-8");
    return JSON.parse(raw) as QueueItem[];
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw e;
  }
}

async function fsSet(items: QueueItem[]): Promise<boolean> {
  try {
    await fs.mkdir(path.dirname(QUEUE_FILE), { recursive: true });
    await fs.writeFile(QUEUE_FILE, JSON.stringify(items, null, 2), "utf-8");
    return true;
  } catch {
    return false;
  }
}

// ------------------------------------------------------------------
// Public API
// ------------------------------------------------------------------

/** Load all queue items. */
export async function getAllItems(): Promise<QueueItem[]> {
  return useKv() ? kvGet() : fsGet();
}

/** Persist all queue items (overwrites). */
async function writeAll(items: QueueItem[]): Promise<boolean> {
  return useKv() ? kvSet(items) : fsSet(items);
}

/** Get items filtered by status. */
export async function getItemsByStatus(status: QueueStatus): Promise<QueueItem[]> {
  const all = await getAllItems();
  return all.filter((i) => i.status === status);
}

/** Get pending items (most common dashboard query) — sorted soonest-expiry first. */
export async function getPendingItems(): Promise<QueueItem[]> {
  const all = await getAllItems();
  return all
    .filter((i) => i.status === "pending" || i.status === "edited")
    .sort((a, b) => a.expiresAt.localeCompare(b.expiresAt));
}

/** Get one item by ID. */
export async function getItem(id: string): Promise<QueueItem | null> {
  const all = await getAllItems();
  return all.find((i) => i.id === id) || null;
}

/** Add a new item. Returns the created item with assigned ID. */
export async function addItem(
  partial: Omit<QueueItem, "id" | "createdAt" | "expiresAt" | "status">
): Promise<QueueItem> {
  const all = await getAllItems();
  const now = new Date();
  const item: QueueItem = {
    ...partial,
    id: crypto.randomUUID(),
    createdAt: now.toISOString(),
    expiresAt: calculateExpiresAt(partial.channel, now),
    status: "pending",
  };
  all.push(item);
  await writeAll(all);
  return item;
}

/** Add many items at once (for pipeline bulk enqueue). */
export async function addItems(
  partials: Array<Omit<QueueItem, "id" | "createdAt" | "expiresAt" | "status">>
): Promise<QueueItem[]> {
  const all = await getAllItems();
  const now = new Date();
  const created = partials.map((p) => ({
    ...p,
    id: crypto.randomUUID(),
    createdAt: now.toISOString(),
    expiresAt: calculateExpiresAt(p.channel, now),
    status: "pending" as QueueStatus,
  }));
  all.push(...created);
  await writeAll(all);
  return created;
}

/** Update an item by ID. Returns updated item or null if not found. */
export async function updateItem(
  id: string,
  patch: Partial<QueueItem>
): Promise<QueueItem | null> {
  const all = await getAllItems();
  const idx = all.findIndex((i) => i.id === id);
  if (idx === -1) return null;
  all[idx] = { ...all[idx], ...patch };
  await writeAll(all);
  return all[idx];
}

/** Delete an item by ID. */
export async function deleteItem(id: string): Promise<boolean> {
  const all = await getAllItems();
  const filtered = all.filter((i) => i.id !== id);
  if (filtered.length === all.length) return false;
  await writeAll(filtered);
  return true;
}

/** Bulk update — mark items as expired if past expiresAt. Returns count expired. */
export async function expireStaleItems(now = new Date()): Promise<number> {
  const all = await getAllItems();
  let count = 0;
  for (const item of all) {
    if (
      (item.status === "pending" || item.status === "edited") &&
      new Date(item.expiresAt).getTime() < now.getTime()
    ) {
      item.status = "expired";
      item.actedAt = now.toISOString();
      count++;
    }
  }
  if (count > 0) await writeAll(all);
  return count;
}

/** Stats for the dashboard. */
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
    byChannel[item.channel] = (byChannel[item.channel] || 0) + 1;
  }
  return {
    total: all.length,
    pending: all.filter((i) => i.status === "pending").length,
    approved: all.filter((i) => i.status === "approved").length,
    posted: all.filter((i) => i.status === "posted").length,
    skipped: all.filter((i) => i.status === "skipped").length,
    expired: all.filter((i) => i.status === "expired").length,
    edited: all.filter((i) => i.status === "edited").length,
    byChannel: byChannel as Record<QueueChannel, number>,
  };
}

/** Storage backend label — for diagnostics on the dashboard. */
export function getStorageBackend(): "vercel-kv" | "file-system" {
  return useKv() ? "vercel-kv" : "file-system";
}
