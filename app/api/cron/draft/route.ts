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
import { dedupeEntries, similarity } from "@/lib/pipeline/dedupe";
import { clusterAndScore } from "@/lib/pipeline/cluster";
import { getWhitelistDomains } from "@/lib/sources/registry";
import {
  addReservedDraft,
  failDraftCluster,
  getAllDrafts,
  getStorageBackend,
  reserveDraftCluster,
} from "@/lib/news-review/storage";
import { draftFromCluster } from "@/lib/news-review/draft-engine";
import { NEWS_ARTICLES } from "@/content/news";
import { dubaiCalendarDate } from "@/lib/dubai-time";
import { productionFeatureAvailable } from "@/lib/operations/features";
import {
  authorizeServerMutation,
  privateJson,
  publicStatusJson,
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

async function run(req: NextRequest) {
  const auth = authorizeServerMutation(req, { allowCronBearer: true });
  if (!auth.ok) return auth.response;
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
        maxSearches: 2,
        maxTokens: 3000,
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
    results,
    ranAt: new Date().toISOString(),
  });
}

export function GET() {
  return publicStatusJson({
    name: "News drafting cron",
    mutationMethod: "POST",
    enabled: productionFeatureAvailable("ENABLE_NEWS_DRAFT_CRON"),
    storageBackend: getStorageBackend(),
    publishing: "never; successful output is staged for review",
  });
}
export async function POST(req: NextRequest) {
  return run(req);
}
