// Press draft storage — file-system-backed, lives at content/press-inbound/.
//
// Each draft is a single JSON file: content/press-inbound/<slug>.json
// The directory is committed to git so drafts are visible in the repo.
// Approved drafts are hand-rewritten into proper content/news/<slug>.ts files.

import { promises as fs } from "node:fs";
import path from "node:path";
import type { PressDraft } from "./types";

const DRAFT_DIR = path.join(process.cwd(), "content", "press-inbound");

async function ensureDir() {
  await fs.mkdir(DRAFT_DIR, { recursive: true });
}

/** Save one draft. Returns the file path. */
export async function saveDraft(draft: PressDraft): Promise<string> {
  await ensureDir();
  const filePath = path.join(DRAFT_DIR, `${draft.slug}.json`);
  await fs.writeFile(filePath, JSON.stringify(draft, null, 2), "utf-8");
  return filePath;
}

/** Save many drafts at once. Returns array of file paths. */
export async function saveDrafts(drafts: PressDraft[]): Promise<string[]> {
  const paths: string[] = [];
  for (const d of drafts) {
    paths.push(await saveDraft(d));
  }
  return paths;
}

/** List all draft filenames currently in the inbox. */
export async function listDrafts(): Promise<string[]> {
  try {
    const files = await fs.readdir(DRAFT_DIR);
    return files.filter((f) => f.endsWith(".json"));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw e;
  }
}

/** Read one draft by slug. */
export async function getDraft(slug: string): Promise<PressDraft | null> {
  try {
    const raw = await fs.readFile(path.join(DRAFT_DIR, `${slug}.json`), "utf-8");
    return JSON.parse(raw) as PressDraft;
  } catch {
    return null;
  }
}

/** Update draft status (accepted / rejected). */
export async function setDraftStatus(
  slug: string,
  status: "pending" | "accepted" | "rejected"
): Promise<boolean> {
  const draft = await getDraft(slug);
  if (!draft) return false;
  draft.status = status;
  await saveDraft(draft);
  return true;
}

/** Delete a draft file. */
export async function deleteDraft(slug: string): Promise<boolean> {
  try {
    await fs.unlink(path.join(DRAFT_DIR, `${slug}.json`));
    return true;
  } catch {
    return false;
  }
}
