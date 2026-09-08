// Research, stage and optionally auto-publish one evidence-ready article from
// GitHub Actions.
//
// A durable cluster reservation is acquired before any paid model work.
// Successful staging and the reservation transition happen atomically in the
// server draft store. AUTO_APPROVE=1 enables the bounded publication pass.

import { NEWS_ARTICLES } from "../content/news/index.js";
import {
  draftFromCluster,
  planDraftCandidates,
} from "../lib/news-review/draft-engine.js";
import { findRecentLiveArticleDuplicate } from "../lib/news-review/duplicate-guard.js";
import type { NewsDraft } from "../lib/news-review/types.js";
import {
  runAutoApprove,
  type AutoApproveSummary,
} from "../lib/news-review/auto-approve.js";
import { clusterAndScore } from "../lib/pipeline/cluster.js";
import { dedupeEntries } from "../lib/pipeline/dedupe.js";
import {
  fetchAllSources,
  flattenEntries,
  summarizeFetchRun,
} from "../lib/sources/fetchers/index.js";
import { getWhitelistDomains } from "../lib/sources/registry.js";
import {
  buildNewsCronRunReport,
  emitNewsCronRunReport,
  observeNewestPublication,
} from "./lib/news-cron-outcome.js";
import { selectDraftClusters } from "../lib/news-review/manual-candidate.js";
import { assertCuratedPublicationOutcome } from "../lib/news-review/curated-candidates.js";
import { guardAutomatedMorningPublication } from "../lib/news-scheduler/coverage.js";

const SITE = process.env.SITE_URL || "https://news.investwithraj.com";
const SECRET = process.env.POST_PUBLISH_SECRET || "";
const MIN_SCORE = Number.parseInt(process.env.PIPELINE_MIN_SCORE ?? "45", 10);
const MAX_DRAFTS = Number.parseInt(process.env.PIPELINE_CAP ?? "1", 10);
const MAX_ATTEMPTS = Number.parseInt(
  process.env.PIPELINE_MAX_ATTEMPTS ?? "6",
  10,
);
const CANDIDATE_POOL = Number.parseInt(
  process.env.PIPELINE_CANDIDATE_POOL ?? "30",
  10,
);

interface ReservationResponse {
  acquired?: boolean;
  reservation?: { token?: string };
  error?: string;
}

async function reserveCluster(
  clusterId: string,
  topic: string,
): Promise<string | null> {
  const response = await fetch(`${SITE}/api/news/draft/reservation`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-post-publish-secret": SECRET,
    },
    body: JSON.stringify({
      action: "reserve",
      clusterId,
      topic,
      retryFailed: process.env.PIPELINE_RETRY_FAILED === "1",
    }),
  });
  const payload = (await response.json().catch(() => ({}))) as
    ReservationResponse;
  if (response.status === 409 && payload.acquired === false) return null;
  const token = payload.reservation?.token;
  if (!response.ok || !token) {
    throw new Error(
      typeof payload.error === "string"
        ? payload.error
        : `cluster reservation failed (${response.status})`,
    );
  }
  return token;
}

async function markClusterFailed(
  clusterId: string,
  token: string,
  result: string,
): Promise<void> {
  const response = await fetch(`${SITE}/api/news/draft/reservation`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-post-publish-secret": SECRET,
    },
    body: JSON.stringify({
      action: "fail",
      clusterId,
      token,
      result: result.slice(0, 500),
    }),
  });
  if (!response.ok && response.status !== 409) {
    throw new Error(`reservation failure record failed (${response.status})`);
  }
}

async function runPublicationPass(
  requiredPublishedDubaiDate?: string,
): Promise<AutoApproveSummary | null> {
  const curatedPublication = process.env.CURATED_PUBLICATION === "1";
  const targetDraftId = process.env.AUTO_APPROVE_TARGET_DRAFT_ID;
  const targetContentHash = process.env.AUTO_APPROVE_TARGET_CONTENT_HASH;
  const targetSlug = process.env.AUTO_APPROVE_TARGET_SLUG;
  const curatedCandidateKey = process.env.CURATED_CANDIDATE_KEY;
  if (
    curatedPublication &&
    (!targetDraftId ||
      !targetContentHash ||
      !targetSlug ||
      !curatedCandidateKey ||
      process.env.AUTO_APPROVE !== "1")
  ) {
    throw new Error(
      "Curated publication requires auto-approval plus an exact candidate key, slug, staged draft ID and content hash.",
    );
  }
  if (process.env.AUTO_APPROVE !== "1") {
    console.log("assessment disabled; all drafts remain in The Desk");
    return null;
  }
  const summary = await runAutoApprove({
    site: SITE,
    secret: SECRET,
    publish: true,
    publishLimit: Number.parseInt(process.env.AUTO_PUBLISH_LIMIT ?? "1", 10),
    publishOrder:
      process.env.AUTO_PUBLISH_ORDER === "backlog" ? "backlog" : "newest",
    backlogMinAgeHours: Number.parseInt(
      process.env.AUTO_BACKLOG_MIN_AGE_HOURS ?? "12",
      10,
    ),
    backlogMaxAgeDays: Number.parseInt(
      process.env.AUTO_BACKLOG_MAX_AGE_DAYS ?? "21",
      10,
    ),
    targetDraftId: curatedPublication ? targetDraftId : undefined,
    targetContentHash: curatedPublication ? targetContentHash : undefined,
    requiredPublishedDubaiDate,
    automatedMorningLane: requiredPublishedDubaiDate !== undefined,
  });
  console.log(
    `publication: ${summary.published} committed, ${summary.held} held, ${summary.deferred} deferred, ${summary.failed} failed`,
  );
  if (curatedPublication) {
    assertCuratedPublicationOutcome(
      curatedCandidateKey ?? "",
      targetSlug ?? "",
      summary,
    );
  }
  return summary;
}

interface RunState {
  candidates: number;
  attempts: number;
  staged: number;
  draftHeld: number;
  draftHoldReasons: string[];
  technicalFailures: number;
  failureMessages: string[];
  publication: AutoApproveSummary | null;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "unknown pipeline failure";
}

async function executePipeline(state: RunState): Promise<void> {
  const runNow = new Date();
  const morningGuard = await guardAutomatedMorningPublication({
    environment: process.env,
    now: runNow,
    site: SITE,
    repositoryArticles: NEWS_ARTICLES,
  });
  if (morningGuard.automated && morningGuard.covered) {
    console.log(
      `automated morning lane already covered for ${morningGuard.morningDate}; paid research and publication skipped`,
    );
    return;
  }
  if (morningGuard.automated) {
    console.log(
      `automated morning lane open for ${morningGuard.morningDate}; one evidence-gated publication remains permitted`,
    );
  }
  if (new TextEncoder().encode(SECRET).byteLength < 32) {
    throw new Error("A strong POST_PUBLISH_SECRET is required.");
  }
  if (process.env.DRAFT_ENABLED === "0") {
    console.log("publication-only run: paid drafting and source ingestion skipped");
    state.publication = await runPublicationPass(
      morningGuard.automated ? morningGuard.morningDate : undefined,
    );
    return;
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY not set.");
  }

  console.log(`draft-once · ${new Date().toISOString()}`);

  const existingResponse = await fetch(`${SITE}/api/news/draft`, {
    headers: { "x-post-publish-secret": SECRET },
    cache: "no-store",
  });
  if (!existingResponse.ok) {
    throw new Error(
      `existing draft list failed closed (${existingResponse.status})`,
    );
  }
  const existing = (await existingResponse.json()) as {
    drafts?: NewsDraft[];
  };
  const existingDrafts = existing.drafts ?? [];
  const run = await fetchAllSources();
  console.log(summarizeFetchRun(run));
  if (run.okCount === 0) {
    throw new Error(
      `source ingestion failed closed: all ${run.errorCount} configured sources errored`,
    );
  }
  const deduped = dedupeEntries(flattenEntries(run));
  const requestedCandidate = process.env.PIPELINE_CANDIDATE_KEY ?? "auto";
  const clusters = selectDraftClusters(
    clusterAndScore(deduped, CANDIDATE_POOL),
    MIN_SCORE,
    requestedCandidate,
  );
  const candidatePlan = planDraftCandidates({
    clusters,
    drafts: existingDrafts,
    publishedArticles: NEWS_ARTICLES,
    now: runNow,
    minRecoveryAgeHours: Number.parseInt(
      process.env.AUTO_REDRAFT_MIN_AGE_HOURS ?? "24",
      10,
    ),
  });
  const candidates = candidatePlan.candidates;
  console.log(
    `selected clusters (${requestedCandidate === "auto" ? `score >= ${MIN_SCORE}` : requestedCandidate}): ${clusters.length}; candidates: ${candidates.length}; recoverable held drafts: ${candidatePlan.recoverableHeld}`,
  );
  state.candidates = candidates.length;

  const whitelist = getWhitelistDomains();
  for (const cluster of candidates) {
    if (state.staged >= MAX_DRAFTS || state.attempts >= MAX_ATTEMPTS) break;

    const reservationToken = await reserveCluster(cluster.id, cluster.topic);
    if (!reservationToken) {
      console.log(`skip reserved cluster: ${cluster.topic.slice(0, 72)}`);
      continue;
    }
    state.attempts += 1;

    console.log(
      `researching: ${cluster.topic.slice(0, 72)} (score ${cluster.score})`,
    );
    let result: Awaited<ReturnType<typeof draftFromCluster>>;
    try {
      result = await draftFromCluster(cluster, whitelist, {
        model: process.env.DRAFT_MODEL,
        maxSearches: 8,
        maxTokens: 5_200,
      });
    } catch (error) {
      const reason =
        error instanceof Error ? error.message : "draft provider failed";
      await markClusterFailed(cluster.id, reservationToken, reason);
      state.technicalFailures += 1;
      state.failureMessages.push(`draft provider: ${reason}`);
      console.error(`draft provider failed: ${reason}`);
      continue;
    }

    if (!result.ok || !result.article || !result.provenance) {
      const reason = result.reason ?? "draft did not pass staging";
      await markClusterFailed(cluster.id, reservationToken, reason);
      state.draftHeld += 1;
      state.draftHoldReasons.push(reason.slice(0, 500));
      console.log(`held: ${reason}`);
      continue;
    }

    const duplicateHold = findRecentLiveArticleDuplicate(
      result.article,
      NEWS_ARTICLES,
      { now: runNow },
    );
    if (duplicateHold) {
      await markClusterFailed(
        cluster.id,
        reservationToken,
        duplicateHold.reason,
      );
      state.draftHeld += 1;
      state.draftHoldReasons.push(duplicateHold.reason);
      console.log(`held: ${duplicateHold.reason}`);
      continue;
    }

    const response = await fetch(`${SITE}/api/news/draft`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-post-publish-secret": SECRET,
      },
      body: JSON.stringify({
        article: result.article,
        provenance: result.provenance,
        reservationToken,
        reviewNote: candidatePlan.recoveryDraftIds[cluster.id]
          ? `Automated recovery draft. The previous held draft ${candidatePlan.recoveryDraftIds[cluster.id]} remains preserved for comparison.`
          : undefined,
      }),
    });
    if (response.ok) {
      const stagedPayload = (await response.json().catch(() => ({}))) as {
        draft?: Pick<NewsDraft, "id" | "revision" | "contentHash">;
      };
      state.staged += 1;
      console.log(`staged for review: ${result.article.slug}`);
      if (requestedCandidate !== "auto") {
        console.log(
          `manual candidate staged for human review:\n${JSON.stringify(
            {
              candidateKey: requestedCandidate,
              draft: stagedPayload.draft,
              article: result.article,
              sources: result.provenance.sources.map((source) => ({
                name: source.name,
                tier: source.tier,
                url: source.url,
                publishedAt: source.publishedAt,
              })),
            },
            null,
            2,
          )}`,
        );
      }
      continue;
    }

    state.technicalFailures += 1;
    state.failureMessages.push(
      `draft staging failed (${response.status}) for ${result.article.slug}`,
    );
    try {
      await markClusterFailed(
        cluster.id,
        reservationToken,
        `draft staging failed (${response.status})`,
      );
    } catch (error) {
      state.technicalFailures += 1;
      state.failureMessages.push(errorMessage(error));
    }
    console.error(
      `staging failed (${response.status}) for ${result.article.slug}`,
    );
  }

  console.log(
    `done: ${state.staged} staged from ${state.attempts} attempt(s)`,
  );

  if (morningGuard.automated) {
    const finalMorningGuard = await guardAutomatedMorningPublication({
      environment: process.env,
      now: new Date(),
      site: SITE,
      repositoryArticles: NEWS_ARTICLES,
    });
    if (finalMorningGuard.automated && finalMorningGuard.covered) {
      console.log(
        `automated morning lane became covered for ${finalMorningGuard.morningDate}; publication skipped after final coverage check`,
      );
      return;
    }
  }

  state.publication = await runPublicationPass(
    morningGuard.automated ? morningGuard.morningDate : undefined,
  );
}

async function main(): Promise<void> {
  const startedAt = new Date().toISOString();
  const state: RunState = {
    candidates: 0,
    attempts: 0,
    staged: 0,
    draftHeld: 0,
    draftHoldReasons: [],
    technicalFailures: 0,
    failureMessages: [],
    publication: null,
  };
  let executionError: Error | null = null;
  let observation: Awaited<ReturnType<typeof observeNewestPublication>> | null =
    null;

  try {
    await executePipeline(state);
  } catch (error) {
    executionError =
      error instanceof Error ? error : new Error("unknown pipeline failure");
    state.technicalFailures += 1;
    state.failureMessages.push(errorMessage(error));
  }

  try {
    observation = await observeNewestPublication({ site: SITE });
  } catch (error) {
    executionError ??=
      error instanceof Error
        ? error
        : new Error("front feed observation failed");
    state.technicalFailures += 1;
    state.failureMessages.push(errorMessage(error));
  }

  const report = buildNewsCronRunReport({
    startedAt,
    finishedAt: new Date().toISOString(),
    draftingEnabled: process.env.DRAFT_ENABLED !== "0",
    ...state,
    observation,
    maxNewestPublicationAgeHours: Number.parseInt(
      process.env.NEWS_STALE_AFTER_HOURS ?? "36",
      10,
    ),
  });
  await emitNewsCronRunReport(report);

  if (report.shouldFail) {
    throw (
      executionError ??
      new Error(
        `daily news pipeline requires action: ${report.actionableReasons.slice(0, 3).join("; ") || `${report.failed} operational failure(s)`}`,
      )
    );
  }
}

main().catch((error) => {
  console.error("draft-once failed:", error);
  process.exit(1);
});
