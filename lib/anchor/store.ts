// Daily Anchor state store.
//
// Two adapters, swapped automatically by runtime:
//   - Vercel KV (production)        : set KV_REST_API_URL + KV_REST_API_TOKEN
//   - File-system (local dev / CLI) : pipeline-runs/daily-anchor.json
//
// Production on Vercel writes are ephemeral (filesystem is read-only), so KV
// is mandatory there. Same KV instance provisioned for the outreach queue —
// different key prefix.

import { promises as fs } from "node:fs";
import path from "node:path";
import type { DailyAnchor } from "@/content/daily-anchor/types";

const ROOT = path.join(process.cwd(), "pipeline-runs");
const CURRENT_FILE = path.join(ROOT, "daily-anchor.json");

const KV_URL = process.env.KV_REST_API_URL || "";
const KV_TOKEN = process.env.KV_REST_API_TOKEN || "";
const KV_KEY = "iwr:anchor:current";

function useKv(): boolean {
  return Boolean(KV_URL && KV_TOKEN);
}

// ─── KV adapter (Upstash REST) ───────────────────────────────────────

async function kvReadAnchor(): Promise<DailyAnchor | null> {
  try {
    const res = await fetch(`${KV_URL}/get/${KV_KEY}`, {
      headers: { Authorization: `Bearer ${KV_TOKEN}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { result?: unknown };
    if (data.result == null) return null;
    if (typeof data.result === "string") {
      try {
        return JSON.parse(data.result) as DailyAnchor;
      } catch {
        return null;
      }
    }
    if (typeof data.result === "object") return data.result as DailyAnchor;
    return null;
  } catch {
    return null;
  }
}

async function kvWriteAnchor(anchor: DailyAnchor): Promise<boolean> {
  try {
    const res = await fetch(`${KV_URL}/set/${KV_KEY}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${KV_TOKEN}`,
        "Content-Type": "text/plain",
      },
      body: JSON.stringify(anchor),
      cache: "no-store",
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function kvArchiveAnchor(anchor: DailyAnchor): Promise<void> {
  try {
    const key = `iwr:anchor:archive:${anchor.date}`;
    await fetch(`${KV_URL}/set/${key}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${KV_TOKEN}`,
        "Content-Type": "text/plain",
      },
      body: JSON.stringify(anchor),
      cache: "no-store",
    });
  } catch {
    // Best-effort
  }
}

// ─── File-system adapter (local dev fallback) ────────────────────────

async function fsReadAnchor(): Promise<DailyAnchor | null> {
  try {
    const raw = await fs.readFile(CURRENT_FILE, "utf-8");
    return JSON.parse(raw) as DailyAnchor;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
    return null;
  }
}

async function fsWriteAnchor(anchor: DailyAnchor): Promise<boolean> {
  try {
    await fs.mkdir(ROOT, { recursive: true });
    const existing = await fsReadAnchor();
    if (existing && existing.date !== anchor.date) {
      const archived = path.join(ROOT, `daily-anchor-${existing.date}.json`);
      try {
        await fs.writeFile(archived, JSON.stringify(existing, null, 2), "utf-8");
      } catch {
        // Best-effort
      }
    }
    await fs.writeFile(CURRENT_FILE, JSON.stringify(anchor, null, 2), "utf-8");
    return true;
  } catch {
    return false;
  }
}

// ─── Public API ──────────────────────────────────────────────────────

export async function readCurrentAnchor(): Promise<DailyAnchor | null> {
  return useKv() ? kvReadAnchor() : fsReadAnchor();
}

export async function writeCurrentAnchor(anchor: DailyAnchor): Promise<void> {
  if (useKv()) {
    // Archive previous day before overwriting (KV is single-key per "current")
    const existing = await kvReadAnchor();
    if (existing && existing.date !== anchor.date) {
      await kvArchiveAnchor(existing);
    }
    await kvWriteAnchor(anchor);
    return;
  }
  await fsWriteAnchor(anchor);
}

export function getAnchorStorageBackend(): "vercel-kv" | "file-system" {
  return useKv() ? "vercel-kv" : "file-system";
}
