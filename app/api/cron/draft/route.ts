// Daily draft cron (Vercel) — FALLBACK trigger.
//
// NOTE: web-research drafting (Claude web_search) reliably exceeds Vercel
// Hobby's 60s function cap, so this endpoint usually times out. The real
// daily driver is scripts/draft-once.ts run by GitHub Actions (no time
// limit) — see .github/workflows/news-cron.yml. This route is kept for a
// manual same-process trigger + as a Pro-tier path (raise maxDuration).
//
// Shares the drafting engine with the script (lib/news-review/draft-engine).
// Auth: Vercel Cron bearer or x-post-publish-secret. URL credentials rejected.

import { NextRequest } from "next/server";
import { isClaudeConfigured } from "@/lib/ai/claude";
import { fetchAllSources, flattenEntries } from "@/lib/sources/fetchers";
import { dedupeEntries } from "@/lib/pipeline/dedupe";
import { clusterAndScore } from "@/lib/pipeline/cluster";
import { getWhitelistDomains } from "@/lib/sources/registry";
import {
  addReservedDraft,
  failDraftCluster,
  getAllDrafts,
  getStorageBackend,
  reserveDraftCluster,
} from "@/lib/news-review/storage";
import {
  draftFromCluster,
  planDraftCandidates,
} from "@/lib/news-review/draft-engine";
import { NEWS_ARTICLES } from "@/content/news";
import { dubaiCalendarDate } from "@/lib/dubai-time";
import { productionFeatureAvailable } from "@/lib/operations/features";
import {
  authorizeServerMutation,
  privateJson,
} from "@/lib/security/mutation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60; // Vercel Hobby cap

const MIN_SCORE = parseInt(process.env.PIPELINE_MIN_SCORE ?? "45", 10);
const MAX_DRAFTS_PER_RUN = parseInt(process.env.PIPELINE_CAP ?? "1", 10);
const MAX_ATTEMPTS = parseInt(process.env.PIPELINE_MAX_ATTEMPTS ?? "1", 10);

function isToday(iso: string): boolean {
  return dubaiCalendarDate(iso) === dubaiCalendarDate(new Date());
}

async function run(req: NextRequest, options: { cronGet?: boolean } = {}) {
  const auth = authorizeServerMutation(req, { allowCronBearer: true });
  if (!auth.ok) return auth.response;
  if (options.cronGet && auth.credential !== "cron") {
    return privateJson(
      { error: "Scheduled GET requires the Vercel Cron bearer credential." },
      403,
    );
  }
  if (!productionFeatureAvailable("ENABLE_NEWS_DRAFT_CRON")) {
    return privateJson({ error: "News drafting cron is disabled." }, 503);
  }
  if (
    process.env.NODE_ENV === "production" &&
    getStorageBackend() !== "vercel-kv"
  ) {
    return privateJson(
      { error: "Durable draft storage is required in production." },
      503,
    );
  }
  if (!isClaudeConfigured()) {
    return privateJson({ error: "Drafting provider is not configured." }, 503);
  }

  const fetchRun = await fetchAllSources();
  const entries = flattenEntries(fetchRun);
  const deduped = dedupeEntries(entries);
  const clusters = clusterAndScore(deduped, 12).filter((c) => c.score >= MIN_SCORE);

  const existing = await getAllDrafts();
  const candidatePlan = planDraftCandidates({
    clusters,
    drafts: existing,
    publishedTitles: NEWS_ARTICLES.filter(
      (article) => article.status !== "research" && isToday(article.publishedAt),
    ).map((article) => article.title),
    minRecoveryAgeHours: parseInt(
      process.env.AUTO_REDRAFT_MIN_AGE_HOURS ?? "24",
      10,
    ),
  });
  const candidates = candidatePlan.candidates;

  const whitelist = getWhitelistDomains();
  const results: { topic: string; ok: boolean; reason?: string }[] = [];
  let staged = 0;
  let attempts = 0;
  const maxDrafts = options.cronGet ? 1 : MAX_DRAFTS_PER_RUN;
  const maxAttempts = options.cronGet ? 1 : MAX_ATTEMPTS;
  for (const cluster of candidates) {
    if (staged >= maxDrafts || attempts >= maxAttempts) break;
    attempts++;
    const reservation = await reserveDraftCluster(
      cluster.id,
      cluster.topic,
    );
    if (!reservation.acquired) {
      results.push({
        topic: cluster.topic.slice(0, 80),
        ok: false,
        reason: "cluster already reserved or staged",
      });
      continue;
    }
    try {
      const r = await draftFromCluster(cluster, whitelist, {
        model: process.env.DRAFT_MODEL ?? "claude-haiku-4-5-20251001",
        maxSearches: options.cronGet ? 1 : 2,
        maxTokens: options.cronGet ? 2_600 : 3_000,
      });
      results.push({
        topic: cluster.topic.slice(0, 80),
        ok: r.ok,
        reason: r.reason,
      });
      if (r.ok && r.article && r.provenance) {
        await addReservedDraft({
          article: r.article,
          provenance: r.provenance,
          reservationToken: reservation.reservation.token,
          reviewNote: candidatePlan.recoveryDraftIds[cluster.id]
            ? `Automated recovery draft. The previous held draft ${candidatePlan.recoveryDraftIds[cluster.id]} remains preserved for comparison.`
            : undefined,
        });
        staged++;
      } else {
        await failDraftCluster(
          cluster.id,
          reservation.reservation.token,
          r.reason ?? "draft did not pass staging",
        );
      }
    } catch (error) {
      const reason =
        error instanceof Error ? error.message : "draft provider failed";
      await failDraftCluster(
        cluster.id,
        reservation.reservation.token,
        reason,
      ).catch(() => undefined);
      results.push({
        topic: cluster.topic.slice(0, 80),
        ok: false,
        reason,
      });
    }
  }

  return privateJson({
    ok: true,
    fetched: entries.length,
    deduped: deduped.length,
    clustersOverThreshold: clusters.length,
    candidatesUndrafted: candidates.length,
    attempted: attempts,
    staged,
    recoverableHeld: candidatePlan.recoverableHeld,
    results,
    ranAt: new Date().toISOString(),
  });
}

export async function GET(req: NextRequest) {
  // Vercel Cron invokes GET. Never turn a missing CRON_SECRET into a green
  // read-only response: an unauthenticated scheduled request must fail loudly.
  return run(req, { cronGet: true });
}
export async function POST(req: NextRequest) {
  return run(req);
}
