// Press inbox poller — fetches unread emails from raj@news.investwithraj.com,
// converts each to a PressDraft, persists to content/press-inbound/<slug>.json.
//
// Called by:
//   - schedule-skill on the daily cron (after the morning pipeline run)
//   - Manually via curl for ad-hoc polls
//
// Usage:
//   POST /api/press-inbox?secret=<POST_PUBLISH_SECRET>
//     Optional body: { "markSeen": true | false (default true), "minScore": 0.3 }
//   GET  /api/press-inbox  — health check + listing of current drafts

import { NextRequest, NextResponse } from "next/server";
import {
  fetchUnreadPressEmails,
  markSeen,
  isImapConfigured,
} from "@/lib/press-inbox/imap-client";
import { buildDraft } from "@/lib/press-inbox/draft-builder";
import { saveDrafts, listDrafts } from "@/lib/press-inbox/storage";

export const dynamic = "force-dynamic";

const SECRET = process.env.POST_PUBLISH_SECRET || "";

export async function GET() {
  const drafts = await listDrafts();
  return NextResponse.json({
    name: "news.investwithraj.com press inbox poller",
    method: "POST",
    auth: "?secret=<POST_PUBLISH_SECRET>",
    body: {
      markSeen: "boolean (optional, default true) — mark emails as seen after drafting",
      minScore: "number (optional, default 0) — drop drafts below this relevance",
    },
    imapConfigured: isImapConfigured(),
    currentDraftsInInbox: drafts.length,
    draftFiles: drafts.slice(0, 20),
  });
}

export async function POST(request: NextRequest) {
  if (!SECRET) {
    return NextResponse.json(
      { error: "POST_PUBLISH_SECRET env var not set — endpoint disabled" },
      { status: 503 }
    );
  }
  const provided = request.nextUrl.searchParams.get("secret");
  if (provided !== SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isImapConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "IMAP not configured (IMAP_HOST + IMAP_USERNAME + IMAP_PASSWORD env vars missing). Skipped.",
      },
      { status: 503 }
    );
  }

  let body: { markSeen?: unknown; minScore?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    // Empty body OK
  }

  const shouldMarkSeen = body.markSeen !== false; // default true
  const minScore = typeof body.minScore === "number" ? body.minScore : 0;

  const t0 = performance.now();

  const emails = await fetchUnreadPressEmails();
  const drafts = emails.map((e) => buildDraft(e));
  const kept = drafts.filter((d) => d.relevanceScore >= minScore);
  const filePaths = await saveDrafts(kept);

  if (shouldMarkSeen) {
    // Mark only the kept ones as seen — let unrelated press releases re-process next run
    const keptUids = kept.map((d) => d.source.uid);
    await markSeen(keptUids);
  }

  const elapsedMs = Math.round(performance.now() - t0);

  return NextResponse.json({
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
    filePaths,
    elapsedMs,
    timestamp: new Date().toISOString(),
  });
}
