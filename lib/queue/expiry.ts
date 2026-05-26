// Queue expiry job.
//
// Runs in two contexts:
//   1) On every dashboard render — quick sweep, marks stale items expired
//      so Raj never sees outreach drafts past their SLA
//   2) Daily via cron — periodic cleanup, can also delete very old expired
//      items to keep storage trim
//
// Per-channel SLAs live in types.ts → CHANNEL_POLICIES.

import { getAllItems, expireStaleItems, deleteItem } from "./storage";
import type { QueueItem } from "./types";

/** Mark all stale pending/edited items as expired. Returns count. */
export async function runExpirySweep(now = new Date()): Promise<number> {
  return expireStaleItems(now);
}

/**
 * Delete items that have been in terminal state (posted / skipped / expired)
 * for longer than retentionDays. Default: 30 days.
 */
export async function purgeOldTerminalItems(retentionDays = 30, now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);
  const all = await getAllItems();
  const stale = all.filter(
    (i) =>
      (i.status === "posted" || i.status === "skipped" || i.status === "expired") &&
      i.actedAt &&
      new Date(i.actedAt).getTime() < cutoff.getTime()
  );
  let deleted = 0;
  for (const item of stale) {
    if (await deleteItem(item.id)) deleted++;
  }
  return deleted;
}

/**
 * Combined daily-cron job.
 */
export async function runDailyMaintenance(now = new Date()): Promise<{
  expired: number;
  purged: number;
  timestamp: string;
}> {
  const expired = await runExpirySweep(now);
  const purged = await purgeOldTerminalItems(30, now);
  return {
    expired,
    purged,
    timestamp: now.toISOString(),
  };
}

/** Returns items that will expire within N hours (for dashboard "urgent" badge). */
export async function getUrgentItems(withinHours = 4): Promise<QueueItem[]> {
  const all = await getAllItems();
  const now = new Date();
  const threshold = now.getTime() + withinHours * 60 * 60 * 1000;
  return all
    .filter(
      (i) =>
        (i.status === "pending" || i.status === "edited") &&
        new Date(i.expiresAt).getTime() <= threshold
    )
    .sort((a, b) => a.expiresAt.localeCompare(b.expiresAt));
}
