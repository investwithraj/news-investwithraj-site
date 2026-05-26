// Approval Queue dashboard — Raj's daily outreach review surface.
//
// Auth gated by middleware.ts (basic-auth via INTERNAL_BASIC_AUTH env var).
// Server component — pulls queue state at render, sweeps expiry first.

import {
  getPendingItems,
  getQueueStats,
  getStorageBackend,
  getAllItems,
} from "@/lib/queue/storage";
import { getUrgentItems, runExpirySweep } from "@/lib/queue/expiry";
import { CHANNEL_POLICIES } from "@/lib/queue/types";
import { DashboardClient } from "./DashboardClient";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  // Sweep expiry before showing queue (idempotent — safe to call every render)
  await runExpirySweep();

  const [pending, urgent, stats, allItems] = await Promise.all([
    getPendingItems(),
    getUrgentItems(4),
    getQueueStats(),
    getAllItems(),
  ]);

  // Recent activity = posted/skipped/expired in last 24h
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).getTime();
  const recentActivity = allItems
    .filter(
      (i) =>
        (i.status === "posted" || i.status === "skipped" || i.status === "expired") &&
        i.actedAt &&
        new Date(i.actedAt).getTime() >= dayAgo
    )
    .sort((a, b) => (b.actedAt || "").localeCompare(a.actedAt || ""))
    .slice(0, 20);

  const backend = getStorageBackend();

  return (
    <DashboardClient
      pending={pending}
      urgent={urgent}
      stats={stats}
      recentActivity={recentActivity}
      backend={backend}
      channelPolicies={CHANNEL_POLICIES}
    />
  );
}
