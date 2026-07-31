// Stage one researched article for human review from GitHub Actions.
//
// A durable cluster reservation is acquired before any paid model work.
// Successful staging and the reservation transition happen atomically in the
// server draft store. This script never publishes.

import { NEWS_ARTICLES } from "../content/news/index.js";
import { dubaiCalendarDate } from "../lib/dubai-time.js";
import { draftFromCluster } from "../lib/news-review/draft-engine.js";
import { runAutoApprove } from "../lib/news-review/auto-approve.js";
import { clusterAndScore } from "../lib/pipeline/cluster.js";
import { dedupeEntries, similarity } from "../lib/pipeline/dedupe.js";
import {
  fetchAllSources,
  flattenEntries,
} from "../lib/sources/fetchers/index.js";
import { getWhitelistDomains } from "../lib/sources/registry.js";

const SITE = process.env.SITE_URL || "https://news.investwithraj.com";
const SECRET = process.env.POST_PUBLISH_SECRET || "";
const MIN_SCORE = Number.parseInt(process.env.PIPELINE_MIN_SCORE ?? "45", 10);
const MAX_DRAFTS = Number.parseInt(process.env.PIPELINE_CAP ?? "1", 10);
const MAX_ATTEMPTS = Number.parseInt(
  process.env.PIPELINE_MAX_ATTEMPTS ?? "3",
  10,
);

interface ReservationResponse {
  acquired?: boolean;
  reservation?: { token?: string };
  error?: string;
}

function isToday(iso: string): boolean {
  return dubaiCalendarDate(iso) === dubaiCalendarDate(new Date());
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
    body: JSON.stringify({ action: "reserve", clusterId, topic }),
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

async function main(): Promise<void> {
  if (new TextEncoder().encode(SECRET).byteLength < 32) {
    throw new Error("A strong POST_PUBLISH_SECRET is required.");
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
    drafts?: Array<{
      provenance: { clusterId: string };
      article: { title: string };
    }>;
  };
  const existingDrafts = existing.drafts ?? [];
  const draftedIds = new Set(
    existingDrafts.map((draft) => draft.provenance.clusterId),
  );
  const coveredTitles = [
    ...existingDrafts.map((draft) => draft.article.title),
    ...NEWS_ARTICLES.filter(
      (article) =>
        article.status !== "research" && isToday(article.publishedAt),
    ).map((article) => article.title),
  ];

  const run = await fetchAllSources();
  const deduped = dedupeEntries(flattenEntries(run));
  const clusters = clusterAndScore(deduped, 12).filter(
    (cluster) => cluster.score >= MIN_SCORE,
  );
  const candidates = clusters.filter(
    (cluster) =>
      !draftedIds.has(cluster.id) &&
      !coveredTitles.some(
        (title) => similarity(cluster.topic, title) >= 0.55,
      ),
  );
  console.log(
    `clusters >= ${MIN_SCORE}: ${clusters.length}; candidates: ${candidates.length}`,
  );

  const whitelist = getWhitelistDomains();
  let staged = 0;
  let attempts = 0;
  for (const cluster of candidates) {
    if (staged >= MAX_DRAFTS || attempts >= MAX_ATTEMPTS) break;
    attempts += 1;

    const reservationToken = await reserveCluster(cluster.id, cluster.topic);
    if (!reservationToken) {
      console.log(`skip reserved cluster: ${cluster.topic.slice(0, 72)}`);
      continue;
    }

    console.log(
      `researching: ${cluster.topic.slice(0, 72)} (score ${cluster.score})`,
    );
    let result: Awaited<ReturnType<typeof draftFromCluster>>;
    try {
      result = await draftFromCluster(cluster, whitelist, {
        model: process.env.DRAFT_MODEL,
        maxSearches: 4,
        maxTokens: 4_200,
      });
    } catch (error) {
      const reason =
        error instanceof Error ? error.message : "draft provider failed";
      await markClusterFailed(cluster.id, reservationToken, reason);
      console.log(`held: ${reason}`);
      continue;
    }

    if (!result.ok || !result.article || !result.provenance) {
      const reason = result.reason ?? "draft did not pass staging";
      await markClusterFailed(cluster.id, reservationToken, reason);
      console.log(`held: ${reason}`);
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
      }),
    });
    if (response.ok) {
      staged += 1;
      console.log(`staged for review: ${result.article.slug}`);
      continue;
    }

    const responseText = await response.text().catch(() => "");
    await markClusterFailed(
      cluster.id,
      reservationToken,
      `draft staging failed (${response.status})`,
    ).catch(() => undefined);
    console.log(
      `staging failed (${response.status}): ${responseText.slice(0, 200)}`,
    );
  }

  console.log(`done: ${staged} staged from ${attempts} attempt(s)`);

  if (process.env.AUTO_APPROVE === "1") {
    try {
      const summary = await runAutoApprove({
        site: SITE,
        secret: SECRET,
        publish: false,
      });
      console.log(
        `assessment: ${summary.approved} evidence-ready, ${summary.held} held; nothing published`,
      );
    } catch (error) {
      console.error("assessment failed; drafting is unaffected:", error);
    }
  } else {
    console.log("assessment disabled; all drafts remain in The Desk");
  }
}

main().catch((error) => {
  console.error("draft-once failed:", error);
  process.exit(1);
});
