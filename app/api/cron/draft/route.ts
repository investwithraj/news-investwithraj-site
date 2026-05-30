// Daily draft cron (Vercel) — FALLBACK trigger.
//
// NOTE: web-research drafting (Claude web_search) reliably exceeds Vercel
// Hobby's 60s function cap, so this endpoint usually times out. The real
// daily driver is scripts/draft-once.ts run by GitHub Actions (no time
// limit) — see .github/workflows/news-cron.yml. This route is kept for a
// manual same-process trigger + as a Pro-tier path (raise maxDuration).
//
// Shares the drafting engine with the script (lib/news-review/draft-engine).
// Auth: Bearer ${CRON_SECRET} or ?secret=${POST_PUBLISH_SECRET}.

import { NextRequest, NextResponse } from "next/server";
import { isClaudeConfigured } from "@/lib/ai/claude";
import { fetchAllSources, flattenEntries } from "@/lib/sources/fetchers";
import { dedupeEntries, similarity } from "@/lib/pipeline/dedupe";
import { clusterAndScore } from "@/lib/pipeline/cluster";
import { getWhitelistDomains } from "@/lib/sources/registry";
import { addDraft, getAllDrafts } from "@/lib/news-review/storage";
import { draftFromCluster } from "@/lib/news-review/draft-engine";
import { NEWS_ARTICLES } from "@/content/news";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60; // Vercel Hobby cap

const MIN_SCORE = parseInt(process.env.PIPELINE_MIN_SCORE ?? "45", 10);
const MAX_DRAFTS_PER_RUN = parseInt(process.env.PIPELINE_CAP ?? "1", 10);
const MAX_ATTEMPTS = parseInt(process.env.PIPELINE_MAX_ATTEMPTS ?? "1", 10);

function authorized(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET || "";
  const postSecret = process.env.POST_PUBLISH_SECRET || "";
  const authHeader = req.headers.get("authorization") || "";
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) return true;
  if (postSecret && authHeader === `Bearer ${postSecret}`) return true;
  const provided = req.nextUrl.searchParams.get("secret") || "";
  return Boolean(postSecret && provided === postSecret);
}

function isToday(iso: string): boolean {
  return iso.slice(0, 10) === new Date().toISOString().slice(0, 10);
}

async function run(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isClaudeConfigured()) return NextResponse.json({ error: "ANTHROPIC_API_KEY not set" }, { status: 503 });

  const fetchRun = await fetchAllSources();
  const entries = flattenEntries(fetchRun);
  const deduped = dedupeEntries(entries);
  const clusters = clusterAndScore(deduped, 12).filter((c) => c.score >= MIN_SCORE);

  const existing = await getAllDrafts();
  const draftedIds = new Set(existing.map((d) => d.provenance.clusterId));
  const coveredTitles = [
    ...existing.map((d) => d.article.title),
    ...NEWS_ARTICLES.filter((a) => a.status !== "research" && isToday(a.publishedAt)).map((a) => a.title),
  ];
  const candidates = clusters.filter(
    (c) => !draftedIds.has(c.id) && !coveredTitles.some((t) => similarity(c.topic, t) >= 0.55),
  );

  const whitelist = getWhitelistDomains();
  const results: { topic: string; ok: boolean; reason?: string }[] = [];
  let staged = 0;
  let attempts = 0;
  for (const cluster of candidates) {
    if (staged >= MAX_DRAFTS_PER_RUN || attempts >= MAX_ATTEMPTS) break;
    attempts++;
    const r = await draftFromCluster(cluster, whitelist, {
      model: process.env.DRAFT_MODEL ?? "claude-haiku-4-5-20251001",
      maxSearches: 2,
      maxTokens: 3000,
    });
    results.push({ topic: cluster.topic.slice(0, 80), ok: r.ok, reason: r.reason });
    if (r.ok && r.article && r.provenance) {
      await addDraft({ article: r.article, provenance: r.provenance });
      staged++;
    }
  }

  return NextResponse.json({
    ok: true,
    fetched: entries.length,
    deduped: deduped.length,
    clustersOverThreshold: clusters.length,
    candidatesUndrafted: candidates.length,
    attempted: attempts,
    staged,
    results,
    ranAt: new Date().toISOString(),
  });
}

export async function GET(req: NextRequest) {
  return run(req);
}
export async function POST(req: NextRequest) {
  return run(req);
}
