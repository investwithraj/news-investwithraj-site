// Daily Anchor state store — file-system JSON, same pattern as the other
// pipeline artefacts. One canonical file: pipeline-runs/daily-anchor.json
// holds today's anchor. Yesterday's archive optionally lives at
// pipeline-runs/daily-anchor-YYYY-MM-DD.json.

import { promises as fs } from "node:fs";
import path from "node:path";
import type { DailyAnchor } from "@/content/daily-anchor/types";

const ROOT = path.join(process.cwd(), "pipeline-runs");
const CURRENT = path.join(ROOT, "daily-anchor.json");

export async function readCurrentAnchor(): Promise<DailyAnchor | null> {
  try {
    const raw = await fs.readFile(CURRENT, "utf-8");
    return JSON.parse(raw) as DailyAnchor;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
    return null;
  }
}

export async function writeCurrentAnchor(anchor: DailyAnchor): Promise<void> {
  await fs.mkdir(ROOT, { recursive: true });
  // Snapshot if there's an existing different-date anchor
  const existing = await readCurrentAnchor();
  if (existing && existing.date !== anchor.date) {
    const archived = path.join(ROOT, `daily-anchor-${existing.date}.json`);
    try {
      await fs.writeFile(archived, JSON.stringify(existing, null, 2), "utf-8");
    } catch {
      // archiving is best-effort
    }
  }
  await fs.writeFile(CURRENT, JSON.stringify(anchor, null, 2), "utf-8");
}
