// Daily digest endpoint — schedule-skill calls this at 07:30 GST after
// the morning content cron finishes.
//
// Pulls news articles published in the LAST 24 HOURS from the registry,
// builds the HTML+text digest, creates the Listmonk campaign, and sends
// it immediately (set status → "running").
//
// Usage:
//   POST /api/digest with the server credential header
//     Optional body: { "since": "2026-05-25T06:00:00Z", "preview": true }
//     - since:    ISO timestamp — drop articles older than this (default: 24hr ago)
//     - preview:  when true, returns the built HTML body WITHOUT sending
//   GET /api/digest
//     Returns endpoint self-doc + Listmonk configuration status

import { NextRequest } from "next/server";
import { NEWS_ARTICLES } from "@/content/news";
import { buildDigestDraft } from "@/lib/distribute/digest-builder";
import { isListmonkConfigured } from "@/lib/distribute/listmonk";
import {
  authorizeServerMutation,
  privateJson,
  publicStatusJson,
  readJsonBody,
} from "@/lib/security/mutation";

export const dynamic = "force-dynamic";

const DEFAULT_LOOKBACK_HOURS = 24;

export async function GET() {
  return publicStatusJson({
    name: "news.investwithraj.com daily digest endpoint",
    mutationMethod: "POST",
    body: {
      since: "ISO timestamp (optional) — articles after this. Default: 24hr ago.",
    },
    listmonkConfigured: isListmonkConfigured(),
    delivery:
      "disabled; this endpoint produces a review preview and never sends",
  });
}

export async function POST(request: NextRequest) {
  const auth = authorizeServerMutation(request);
  if (!auth.ok) return auth.response;
  const parsed = await readJsonBody<{ since?: unknown }>(request, {
    maxBytes: 8_192,
    allowEmpty: true,
  });
  if (!parsed.ok) return parsed.response;
  const body = parsed.value;

  const sinceParam = typeof body.since === "string" ? body.since : null;

  // Compute "since" — articles published after this go in the digest
  const since = sinceParam
    ? new Date(sinceParam)
    : new Date(Date.now() - DEFAULT_LOOKBACK_HOURS * 60 * 60 * 1000);

  if (isNaN(since.getTime())) {
    return privateJson(
      { error: `Invalid 'since' timestamp: ${sinceParam}` },
      400,
    );
  }

  // Filter articles by publish time
  const articles = NEWS_ARTICLES
    .filter(
      (a) =>
        a.status !== "research" &&
        new Date(a.publishedAt).getTime() >= since.getTime(),
    )
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));

  if (articles.length === 0) {
    return privateJson({
      ok: true,
      message: "No articles in lookback window — skipped digest send.",
      since: since.toISOString(),
      articleCount: 0,
    });
  }

  // Build the draft
  const draft = buildDigestDraft(articles);

  return privateJson({
    ok: true,
    preview: true,
    delivered: false,
    since: since.toISOString(),
    articleCount: articles.length,
    articleSlugs: articles.map((a) => a.slug),
    subject: draft.subject,
    htmlBody: draft.htmlBody,
    textBody: draft.textBody,
    message:
      "Preview generated for human review. No email or external delivery was attempted.",
  });
}
