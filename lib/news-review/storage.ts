// News draft review-staging store.
//
// Mirrors lib/queue/storage.ts exactly: a single KV key holding a JSON array,
// Upstash-compatible REST (GET /get/<key>, POST /set/<key>), with a file-system
// fallback for local dev. In production on Vercel, KV is required (fs writes
// are ephemeral). Drafts never touch git — the publish route generates the
// article .ts and commits once.

import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { validateDraft, type DraftArticle as ValidatorInput } from "@/lib/voice/validator";
import type { NewsDraft, NewsDraftInput } from "./types";

const DRAFTS_FILE = path.join(process.cwd(), "pipeline-runs", "news-drafts.json");

const KV_URL = process.env.KV_REST_API_URL || "";
const KV_TOKEN = process.env.KV_REST_API_TOKEN || "";
const KV_KEY = "iwr:news:drafts";

function useKv(): boolean {
  return Boolean(KV_URL && KV_TOKEN);
}

// ── KV adapter (Upstash REST) ──────────────────────────────────────────

async function kvGet(): Promise<NewsDraft[]> {
  try {
    const res = await fetch(`${KV_URL}/get/${KV_KEY}`, {
      headers: { Authorization: `Bearer ${KV_TOKEN}` },
      cache: "no-store",
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { result?: unknown };
    if (data.result == null) return [];
    if (Array.isArray(data.result)) return data.result as NewsDraft[];
    if (typeof data.result === "string") {
      try {
        const parsed = JSON.parse(data.result);
        return Array.isArray(parsed) ? (parsed as NewsDraft[]) : [];
      } catch {
        return [];
      }
    }
    return [];
  } catch {
    return [];
  }
}

async function kvSet(drafts: NewsDraft[]): Promise<boolean> {
  try {
    const res = await fetch(`${KV_URL}/set/${KV_KEY}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${KV_TOKEN}`,
        "Content-Type": "text/plain",
      },
      body: JSON.stringify(drafts),
      cache: "no-store",
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ── File-system adapter ────────────────────────────────────────────────

async function fsGet(): Promise<NewsDraft[]> {
  try {
    const raw = await fs.readFile(DRAFTS_FILE, "utf-8");
    return JSON.parse(raw) as NewsDraft[];
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw e;
  }
}

async function fsSet(drafts: NewsDraft[]): Promise<boolean> {
  try {
    await fs.mkdir(path.dirname(DRAFTS_FILE), { recursive: true });
    await fs.writeFile(DRAFTS_FILE, JSON.stringify(drafts, null, 2), "utf-8");
    return true;
  } catch {
    return false;
  }
}

// ── Public API ─────────────────────────────────────────────────────────

export async function getAllDrafts(): Promise<NewsDraft[]> {
  const drafts = useKv() ? await kvGet() : await fsGet();
  // Newest first.
  return drafts.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

async function writeAll(drafts: NewsDraft[]): Promise<boolean> {
  return useKv() ? kvSet(drafts) : fsSet(drafts);
}

export async function getDraft(id: string): Promise<NewsDraft | null> {
  const all = await getAllDrafts();
  return all.find((d) => d.id === id) ?? null;
}

/** Run the 8-gate validator over a draft's article. */
export function validateArticle(article: NewsDraftInput["article"]) {
  return validateDraft(article as unknown as ValidatorInput);
}

/** Create a new review draft. Validator is computed on write. */
export async function addDraft(input: NewsDraftInput): Promise<NewsDraft> {
  const all = await getAllDrafts();
  const now = new Date().toISOString();
  const draft: NewsDraft = {
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
    status: "review",
    article: input.article,
    validator: validateArticle(input.article),
    provenance: input.provenance,
    reviewNote: input.reviewNote,
    verifiedSources: [],
  };
  all.push(draft);
  await writeAll(all);
  return draft;
}

/** Patch a draft. When the article changes, the validator is recomputed. */
export async function updateDraft(
  id: string,
  patch: Partial<Pick<NewsDraft, "article" | "reviewNote" | "verifiedSources" | "provenance">>,
): Promise<NewsDraft | null> {
  const all = await getAllDrafts();
  const idx = all.findIndex((d) => d.id === id);
  if (idx === -1) return null;
  const next: NewsDraft = { ...all[idx], ...patch, updatedAt: new Date().toISOString() };
  if (patch.article) next.validator = validateArticle(patch.article);
  all[idx] = next;
  await writeAll(all);
  return next;
}

export async function deleteDraft(id: string): Promise<boolean> {
  const all = await getAllDrafts();
  const filtered = all.filter((d) => d.id !== id);
  if (filtered.length === all.length) return false;
  await writeAll(filtered);
  return true;
}

export function getStorageBackend(): "vercel-kv" | "file-system" {
  return useKv() ? "vercel-kv" : "file-system";
}
