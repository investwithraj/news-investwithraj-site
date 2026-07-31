// Press inbox poller — fetches unread emails from office@investwithraj.com,
// converts each to a PressDraft, persists to content/press-inbound/<slug>.json.
//
// Called by:
//   - schedule-skill on the daily cron (after the morning pipeline run)
//   - Manually via curl for ad-hoc polls
//
// Usage:
//   POST /api/press-inbox with the server credential header
//     Optional body: { "markSeen": true | false (default true), "minScore": 0.3 }
//   GET  /api/press-inbox  — health check + listing of current drafts

import { NextRequest } from "next/server";
import {
  fetchUnreadPressEmails,
  markSeen,
  isImapConfigured,
} from "@/lib/press-inbox/imap-client";
import { buildDraft } from "@/lib/press-inbox/draft-builder";
import { saveDrafts, listDrafts } from "@/lib/press-inbox/storage";
import {
  authorizeServerMutation,
  privateJson,
  publicStatusJson,
  readJsonBody,
} from "@/lib/security/mutation";

export const dynamic = "force-dynamic";

export async function GET() {
  const drafts = await listDrafts();
  return publicStatusJson({
    name: "news.investwithraj.com press inbox poller",
    mutationMethod: "POST",
    body: {
      markSeen:
        "boolean (optional, default false) — mark only after durable draft save",
      minScore: "number (optional, default 0) — drop drafts below this relevance",
    },
    imapConfigured: isImapConfigured(),
    currentDraftsInInbox: drafts.length,
    productionStorage:
      "disabled until a durable, idempotent press-draft store is connected",
  });
}

export async function POST(request: NextRequest) {
  const auth = authorizeServerMutation(request);
  if (!auth.ok) return auth.response;
  if (process.env.NODE_ENV === "production") {
    return privateJson(
      {
        error:
          "Press inbox polling is disabled until durable idempotent storage replaces server filesystem drafts.",
      },
      503,
    );
  }

  if (!isImapConfigured()) {
    return privateJson(
      {
        ok: false,
        message:
          "IMAP not configured (IMAP_HOST + IMAP_USERNAME + IMAP_PASSWORD env vars missing). Skipped.",
      },
      503,
    );
  }

  const parsed = await readJsonBody<{
    markSeen?: unknown;
    minScore?: unknown;
  }>(request, { maxBytes: 8_192, allowEmpty: true });
  if (!parsed.ok) return parsed.response;
  const body = parsed.value;

  const shouldMarkSeen = body.markSeen === true;
  const minScore =
    typeof body.minScore === "number"
      ? Math.min(1, Math.max(0, body.minScore))
      : 0;

  const t0 = performance.now();

  const emails = await fetchUnreadPressEmails();
  const drafts = emails.map((e) => buildDraft(e));
  const kept = drafts.filter((d) => d.relevanceScore >= minScore);
  const filePaths = await saveDrafts(kept);

  if (shouldMarkSeen && filePaths.length === kept.length) {
    // Mark only the kept ones as seen — let unrelated press releases re-process next run
    const keptUids = kept.map((d) => d.source.uid);
    await markSeen(keptUids);
  }

  const elapsedMs = Math.round(performance.now() - t0);

  return privateJson({
    ok: true,
    fetched: emails.length,
    drafted: kept.length,
    droppedByScore: drafts.length - kept.length,
    markedSeen: shouldMarkSeen ? kept.length : 0,
    minScore,
    drafts: kept.map((d) => ({
      slug: d.slug,
      headline: d.candidateHeadline,
      tier: d.source.tier,
      score: d.relevanceScore,
      tags: d.source.tags,
    })),
    savedDraftCount: filePaths.length,
    elapsedMs,
    timestamp: new Date().toISOString(),
  });
}
