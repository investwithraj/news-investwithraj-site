import assert from "node:assert/strict";

import type { NewsArticle } from "../content/news/types.js";
import {
  findRecentLiveArticleDuplicate,
  MATERIAL_UPDATE_OVERRIDE_SUPPORTED,
  NewsDuplicateHoldError,
  normalizeCanonicalCitationUrl,
  parseSerializedNewsArticle,
  recentRegisteredNewsSlugs,
} from "../lib/news-review/duplicate-guard.js";
import { planDraftCandidates } from "../lib/news-review/draft-engine.js";
import { serializeArticle } from "../lib/news-review/serialize.js";
import type { DraftArticle } from "../lib/news-review/types.js";
import type { Cluster } from "../lib/pipeline/types.js";

const NOW = new Date("2026-09-08T10:00:00.000Z");
const SEP6_TITLE =
  "Aldar and ADCB complete Abu Dhabi's first off-plan mortgage registration";
const SEP7_TITLE =
  "Aldar closes Abu Dhabi's first off-plan mortgage under ADREC framework";
const GULF_URL =
  "https://gulfnews.com/business/property/new-mortgage-option-opens-for-abu-dhabi-off-plan-buyers-with-aldar-and-adcb-deal-1.500663048";
const KT_URL =
  "https://www.khaleejtimes.com/business/aldar-adcb-complete-abu-dhabis-first-off-plan-mortgage-under-new-adrec-framework";

function article(options: {
  slug: string;
  title: string;
  publishedAt: string;
  citations?: string[];
  status?: NewsArticle["status"];
}): NewsArticle {
  const citations = options.citations ?? [GULF_URL, KT_URL];
  return {
    slug: options.slug,
    title: options.title,
    subtitle: "A deterministic duplicate-guard regression fixture.",
    publishedAt: options.publishedAt,
    modifiedAt: options.publishedAt,
    displayDate: "08 Sept 2026",
    author: "raj-tomar",
    tier: "news",
    category: "market-pulse",
    market: ["Abu Dhabi"],
    tldr: ["One", "Two", "Three"],
    body: "Fixture body.",
    faq: [],
    citations: citations.map((url, index) => ({
      source: index === 0 ? "Gulf News — Property" : "Khaleej Times — Real Estate",
      url,
      accessedAt: options.publishedAt,
      tier: "national-press",
    })),
    heroImage: {
      src: `/news/${options.slug}/cover.jpg`,
      alt: "Fixture",
      credit: "Withheld",
    },
    cta: { href: "https://investwithraj.com/engage", label: "Discuss" },
    distribution: {},
    status: options.status ?? "live",
  };
}

function asDraft(value: NewsArticle): DraftArticle {
  const draft = { ...value };
  delete draft.status;
  delete draft.publicationContentHash;
  return draft;
}

function cluster(id: string, topic: string, sourceUrls: string[] = []): Cluster {
  return {
    id,
    topic,
    entries: sourceUrls.map((url, index) => ({
      id: `${id}-source-${index + 1}`,
      title: topic,
      url,
      publishedAt: NOW.toISOString(),
      summary: "Deterministic cluster-source fixture.",
      source: {
        name: index === 0 ? "Gulf News" : "Khaleej Times",
        tier: "national-press",
        domain: new URL(url).hostname,
      },
    })),
    score: 90,
    scoreBreakdown: {
      uhnwRelevance: 25,
      sourceTier: 25,
      freshness: 20,
      rajAngle: 20,
    },
    entities: {
      developers: ["Aldar"],
      places: ["Abu Dhabi"],
      figures: [],
      hasTier1Source: true,
    },
    suggestedCategory: "market-pulse",
    suggestedMarkets: ["Abu Dhabi"],
  };
}

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
}

async function assertGitHubPublicationBoundary(
  existing: NewsArticle,
  candidate: DraftArticle,
): Promise<void> {
  const mutableEnvironment = process.env as Record<string, string | undefined>;
  const previousToken = mutableEnvironment.GITHUB_TOKEN;
  mutableEnvironment.GITHUB_TOKEN = "duplicate-guard-test-token";
  const originalFetch = globalThis.fetch;
  const headSha = "a".repeat(40);
  const treeSha = "b".repeat(40);
  let mutationCount = 0;
  try {
    const github = await import("../lib/news-review/github.js");
    const indexSource =
      `import { article as existing } from "./${existing.slug}";\n` +
      "export const NEWS_ARTICLES = [existing];\n";
    const relationSource = "export const ARTICLE_RELATION_RECORDS = [\n];\n";
    const existingSource = serializeArticle(asDraft(existing));
    globalThis.fetch = async (input, init) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      if (method !== "GET") mutationCount += 1;
      if (url.endsWith("/git/ref/heads/main")) {
        return json({ object: { sha: headSha } });
      }
      if (url.endsWith(`/git/commits/${headSha}`)) {
        return json({ tree: { sha: treeSha } });
      }
      if (url.includes("/contents/content/news/index.ts?ref=main")) {
        return json({
          content: Buffer.from(indexSource).toString("base64"),
          encoding: "base64",
        });
      }
      if (url.includes("/contents/lib/article-relations.ts?ref=main")) {
        return json({
          content: Buffer.from(relationSource).toString("base64"),
          encoding: "base64",
        });
      }
      if (
        url.includes(`/contents/content/news/${existing.slug}.ts?ref=main`)
      ) {
        return json({
          content: Buffer.from(existingSource).toString("base64"),
          encoding: "base64",
        });
      }
      throw new Error(`Unexpected GitHub request: ${method} ${url}`);
    };

    await assert.rejects(
      github.publishArticleCommit(
        candidate.slug,
        candidate,
        null,
        "f".repeat(64),
      ),
      (error: unknown) =>
        error instanceof NewsDuplicateHoldError &&
        error.hold.existingSlug === existing.slug,
      "the current GitHub branch must be checked again before any write",
    );
    assert.equal(mutationCount, 0, "a duplicate hold must happen before Git writes");
  } finally {
    globalThis.fetch = originalFetch;
    if (previousToken === undefined) delete mutableEnvironment.GITHUB_TOKEN;
    else mutableEnvironment.GITHUB_TOKEN = previousToken;
  }
}

async function assertGitHubSurvivorCrossesDuplicateBoundary(
  retired: NewsArticle,
  survivor: DraftArticle,
): Promise<void> {
  const originalFetch = globalThis.fetch;
  const headSha = "a".repeat(40);
  const treeSha = "b".repeat(40);
  const sentinel = "SURVIVOR_PASSED_DUPLICATE_BOUNDARY";
  let retiredArticleReads = 0;
  let mutationCount = 0;
  try {
    const github = await import("../lib/news-review/github.js");
    const indexSource =
      `import { article as survivor } from "./${survivor.slug}";\n` +
      `import { article as retired } from "./${retired.slug}";\n` +
      "export const NEWS_ARTICLES = [survivor, retired];\n";
    const relationSource = "export const ARTICLE_RELATION_RECORDS = [\n];\n";
    globalThis.fetch = async (input, init) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      if (method !== "GET") mutationCount += 1;
      if (url.endsWith("/git/ref/heads/main")) {
        return json({ object: { sha: headSha } });
      }
      if (url.endsWith(`/git/commits/${headSha}`)) {
        return json({ tree: { sha: treeSha } });
      }
      if (url.includes("/contents/content/news/index.ts?ref=main")) {
        return json({
          content: Buffer.from(indexSource).toString("base64"),
          encoding: "base64",
        });
      }
      if (url.includes("/contents/lib/article-relations.ts?ref=main")) {
        return json({
          content: Buffer.from(relationSource).toString("base64"),
          encoding: "base64",
        });
      }
      if (url.includes(`/contents/content/news/${retired.slug}.ts?ref=main`)) {
        retiredArticleReads += 1;
        throw new Error("A released redirect source entered duplicate review.");
      }
      if (url.includes(`/contents/content/news/${survivor.slug}.ts?ref=main`)) {
        throw new Error(sentinel);
      }
      throw new Error(`Unexpected GitHub request: ${method} ${url}`);
    };

    await assert.rejects(
      github.publishArticleCommit(
        survivor.slug,
        survivor,
        null,
        "f".repeat(64),
      ),
      new RegExp(sentinel),
      "the canonical survivor must pass duplicate review before correction handling",
    );
    assert.equal(
      retiredArticleReads,
      0,
      "the current branch must not load a released redirect source for comparison",
    );
    assert.equal(mutationCount, 0, "the boundary probe must not write to GitHub");
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function main(): Promise<void> {
  const sep6 = article({
    slug: "2026-09-06-aldar-completes-abu-dhabi-s-first-off-plan-mortgage-under",
    title: SEP6_TITLE,
    publishedAt: "2026-09-06T19:31:05.544Z",
  });
  const sep7 = article({
    slug: "2026-09-07-aldar-closes-abu-dhabi-s-first-off-plan-mortgage-under",
    title: SEP7_TITLE,
    publishedAt: "2026-09-07T08:13:42.775Z",
  });

  assert.equal(
    findRecentLiveArticleDuplicate(asDraft(sep6), [sep7], { now: NOW }),
    null,
    "the canonical Sep-6 survivor must remain correctable after Sep-7 is retired",
  );

  const thirdCopy = article({
    slug: "2026-09-08-abu-dhabi-off-plan-mortgage-registration-update",
    title: "Abu Dhabi records another off-plan mortgage registration milestone",
    publishedAt: NOW.toISOString(),
  });
  const thirdCopyHold = findRecentLiveArticleDuplicate(
    asDraft(thirdCopy),
    [sep7, sep6],
    { now: NOW },
  );
  assert.equal(thirdCopyHold?.signal, "exact-citation-set");
  assert.equal(
    thirdCopyHold?.existingSlug,
    sep6.slug,
    "a new third copy must be held against the canonical survivor, not the retired source",
  );

  const exactCitationHold = findRecentLiveArticleDuplicate(
    asDraft(sep7),
    [sep6],
    { now: NOW },
  );
  assert.equal(exactCitationHold?.signal, "exact-citation-set");
  assert.equal(exactCitationHold?.existingSlug, sep6.slug);

  assert.equal(
    normalizeCanonicalCitationUrl(
      `${GULF_URL}/?utm_source=duplicate-test&fbclid=ignored#fragment`,
    ),
    normalizeCanonicalCitationUrl(GULF_URL),
    "tracking, fragments, www and trailing slashes must not evade citation matching",
  );

  const titleOnlyCandidate = article({
    ...sep7,
    citations: ["https://www.reuters.com/world/middle-east/distinct-evidence"],
  });
  assert.equal(
    findRecentLiveArticleDuplicate(asDraft(titleOnlyCandidate), [sep6], {
      now: NOW,
    })?.signal,
    "near-duplicate-title",
    "the existing public shared-token/Jaccard rule must catch the Sep-6/Sep-7 titles",
  );

  const distinct = article({
    slug: "2026-09-08-dubai-metro-blue-line-enables-new-station-catchments",
    title: "Dubai Metro Blue Line opens new station catchments for buyers",
    publishedAt: NOW.toISOString(),
    citations: ["https://www.reuters.com/world/middle-east/metro-blue-line"],
  });
  assert.equal(
    findRecentLiveArticleDuplicate(asDraft(distinct), [sep6], { now: NOW }),
    null,
    "a distinct story with distinct evidence must remain eligible",
  );

  const oldDuplicate = {
    ...sep6,
    publishedAt: "2026-08-07T08:00:00.000Z",
    modifiedAt: "2026-08-07T08:00:00.000Z",
  };
  assert.equal(
    findRecentLiveArticleDuplicate(asDraft(sep7), [oldDuplicate], { now: NOW }),
    null,
    "the deterministic guard must remain bounded to 30 days",
  );

  const sameDayPublished = {
    ...sep6,
    publishedAt: "2026-09-08T04:00:00.000Z",
    modifiedAt: "2026-09-08T04:00:00.000Z",
  };
  const sameDayPlan = planDraftCandidates({
    clusters: [cluster("aldar-off-plan-mortgage", SEP7_TITLE)],
    drafts: [],
    publishedArticles: [sameDayPublished],
    now: NOW,
  });
  assert.equal(
    sameDayPlan.candidates.length,
    0,
    "same-day published-title protection must remain in the planning pass",
  );
  const rewordedExactSourcesPlan = planDraftCandidates({
    clusters: [
      cluster(
        "aldar-reworded-exact-source-set",
        "A buyer-finance pathway changes how Abu Dhabi launches are assessed",
        [KT_URL, GULF_URL],
      ),
    ],
    drafts: [],
    publishedArticles: [sameDayPublished],
    now: NOW,
  });
  assert.equal(
    rewordedExactSourcesPlan.candidates.length,
    0,
    "an exact canonical cluster-source set must be held before paid drafting despite a reworded topic",
  );
  const distinctPlan = planDraftCandidates({
    clusters: [cluster("dubai-metro-blue-line", distinct.title)],
    drafts: [],
    publishedArticles: [sameDayPublished],
    now: NOW,
  });
  assert.equal(distinctPlan.candidates.length, 1);

  const unsupportedFollowUp = {
    ...asDraft(sep7),
    updateOf: sep6.slug,
    materialDelta: "A claimed update not represented by the reviewed model.",
    publicationContentHash: "0".repeat(64),
  } as DraftArticle & {
    updateOf: string;
    materialDelta: string;
    publicationContentHash: string;
  };
  assert.equal(MATERIAL_UPDATE_OVERRIDE_SUPPORTED, false);
  assert.ok(
    findRecentLiveArticleDuplicate(unsupportedFollowUp, [sep6], { now: NOW }),
    "unreviewed update fields and a different content hash must never bypass the hold",
  );

  const serialized = serializeArticle(asDraft(sep6));
  assert.equal(parseSerializedNewsArticle(serialized)?.slug, sep6.slug);
  assert.deepEqual(
    recentRegisteredNewsSlugs(
      `import { article as old } from "./2026-08-01-old";\n` +
        `import { article as live } from "./${sep6.slug}";\n` +
        `import { article as retired } from "./${sep7.slug}";\n`,
      { now: NOW, excludeSlug: sep7.slug },
    ),
    [sep6.slug],
  );

  await assertGitHubPublicationBoundary(sep6, asDraft(sep7));
  await assertGitHubSurvivorCrossesDuplicateBoundary(sep7, asDraft(sep6));

  console.log(
    "Cross-day duplicate regression passed: exact Sep-6/Sep-7 evidence and public-title matches are held at planning, staging logic and the current-branch publication boundary; distinct and out-of-window stories pass.",
  );
}

void main();
