// Daily digest endpoint — schedule-skill calls this at 07:30 GST after
// the morning content cron finishes.
//
// Pulls news articles published in the LAST 24 HOURS from the registry,
// builds the HTML+text digest, creates the Listmonk campaign, and sends
// it immediately (set status → "running").
//
// Usage:
//   POST /api/digest?secret=<POST_PUBLISH_SECRET>
//     Optional body: { "since": "2026-05-25T06:00:00Z", "preview": true }
//     - since:    ISO timestamp — drop articles older than this (default: 24hr ago)
//     - preview:  when true, returns the built HTML body WITHOUT sending
//   GET /api/digest
//     Returns endpoint self-doc + Listmonk configuration status

import { NextRequest, NextResponse } from "next/server";
import { NEWS_ARTICLES } from "@/content/news";
import { buildDigestDraft } from "@/lib/distribute/digest-builder";
import {
  isListmonkConfigured,
  sendListmonkDigest,
} from "@/lib/distribute/listmonk";

export const dynamic = "force-dynamic";

const SECRET = process.env.POST_PUBLISH_SECRET || "";
const DEFAULT_LOOKBACK_HOURS = 24;

export async function GET() {
  return NextResponse.json({
    name: "news.investwithraj.com daily digest endpoint",
    method: "POST",
    auth: "?secret=<POST_PUBLISH_SECRET>",
    body: {
      since: "ISO timestamp (optional) — articles after this. Default: 24hr ago.",
      preview: "boolean (optional) — return built HTML without sending. Default: false.",
    },
    listmonkConfigured: isListmonkConfigured(),
    schedule: "07:30 GST daily (via schedule-skill cron after morning content pipeline)",
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

  let body: { since?: unknown; preview?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    // Empty body is fine — use defaults
  }

  const sinceParam = typeof body.since === "string" ? body.since : null;
  const preview = body.preview === true;

  // Compute "since" — articles published after this go in the digest
  const since = sinceParam
    ? new Date(sinceParam)
    : new Date(Date.now() - DEFAULT_LOOKBACK_HOURS * 60 * 60 * 1000);

  if (isNaN(since.getTime())) {
    return NextResponse.json(
      { error: `Invalid 'since' timestamp: ${sinceParam}` },
      { status: 400 }
    );
  }

  // Filter articles by publish time
  const articles = NEWS_ARTICLES
    .filter((a) => new Date(a.publishedAt).getTime() >= since.getTime())
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));

  if (articles.length === 0) {
    return NextResponse.json({
      ok: true,
      message: "No articles in lookback window — skipped digest send.",
      since: since.toISOString(),
      articleCount: 0,
    });
  }

  // Build the draft
  const draft = buildDigestDraft(articles);

  // Preview mode — return the HTML without sending
  if (preview) {
    return NextResponse.json({
      ok: true,
      preview: true,
      since: since.toISOString(),
      articleCount: articles.length,
      subject: draft.subject,
      htmlBody: draft.htmlBody,
      textBody: draft.textBody,
    });
  }

  // Send via Listmonk
  const result = await sendListmonkDigest(draft);

  return NextResponse.json(
    {
      ok: result.ok,
      since: since.toISOString(),
      articleCount: articles.length,
      articleSlugs: articles.map((a) => a.slug),
      subject: draft.subject,
      listmonk: result,
      timestamp: new Date().toISOString(),
    },
    { status: result.ok ? 200 : 503 }
  );
}
