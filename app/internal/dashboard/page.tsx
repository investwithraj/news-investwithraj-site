// Approval Queue dashboard — Raj's daily outreach review surface.
//
// Auth gated by proxy.ts (Basic Auth plus a signed HttpOnly API session).
// Server component — pulls queue state at render, sweeps expiry first.

import {
  getPendingItems,
  getQueueStats,
  getStorageBackend,
  getAllItems,
} from "@/lib/queue/storage";
import { getUrgentItems, runDailyMaintenance } from "@/lib/queue/expiry";
import { CHANNEL_POLICIES } from "@/lib/queue/types";
import type { QueueItem } from "@/lib/queue/types";
import { DashboardClient } from "./DashboardClient";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Outreach queue — internal",
  robots: { index: false, follow: false, noarchive: true },
};

const EMPTY_STATS = {
  total: 0,
  pending: 0,
  approved: 0,
  posted: 0,
  skipped: 0,
  expired: 0,
  edited: 0,
  byChannel: Object.fromEntries(
    Object.keys(CHANNEL_POLICIES).map((channel) => [channel, 0]),
  ) as {
    [K in keyof typeof CHANNEL_POLICIES]: number;
  },
};

export default async function DashboardPage() {
  const backend = getStorageBackend();
  const storageWarning =
    backend === "file-system" && process.env.NODE_ENV === "production"
      ? "Persistent queue storage is not configured. Production mutations should remain disabled until KV_REST_API_URL and KV_REST_API_TOKEN are set."
      : undefined;

  let pending: QueueItem[] = [];
  let urgent: QueueItem[] = [];
  let stats = EMPTY_STATS;
  let recentActivity: QueueItem[] = [];
  let error: string | undefined;

  try {
    // Expire stale work and prune terminal records outside the 30-day audit
    // window before rendering. All deletes remain version-checked.
    await runDailyMaintenance();
    const [loadedPending, loadedUrgent, loadedStats, allItems] =
      await Promise.all([
      getPendingItems(),
      getUrgentItems(4),
      getQueueStats(),
      getAllItems(),
      ]);

    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).getTime();
    pending = loadedPending;
    urgent = loadedUrgent;
    stats = loadedStats;
    recentActivity = allItems
      .filter(
        (item) =>
          (item.status === "posted" ||
            item.status === "skipped" ||
            item.status === "expired") &&
          item.actedAt &&
          new Date(item.actedAt).getTime() >= dayAgo,
      )
      .sort((a, b) => (b.actedAt || "").localeCompare(a.actedAt || ""))
      .slice(0, 20);
  } catch {
    error =
      "The queue store could not be read. No empty state has been treated as real data and all actions are disabled.";
  }

  return (
    <DashboardClient
      pending={pending}
      urgent={urgent}
      stats={stats}
      recentActivity={recentActivity}
      backend={backend}
      channelPolicies={CHANNEL_POLICIES}
      storageWarning={storageWarning}
      error={error}
    />
  );
}
