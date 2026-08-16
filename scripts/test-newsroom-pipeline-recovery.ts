import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  assessPublicationFreshness,
  draftFromCluster,
  type DraftOpts,
} from "../lib/news-review/draft-engine.js";
import {
  extractMainText,
  extractPublicationDate,
  fetchArticleText,
  type FetchedArticleText,
} from "../lib/sources/extract.js";
import type { Cluster } from "../lib/pipeline/types.js";
import {
  draftContentHash,
  evidenceApprovalFor,
} from "../lib/news-review/integrity.js";
import type {
  DraftArticle,
  NewsDraftProvenance,
} from "../lib/news-review/types.js";

const NOW = new Date("2026-08-15T22:00:00.000Z");
const FRESH_DATE = "2026-08-15T08:00:00.000Z";
const REUTERS_URL =
  "https://www.reuters.com/world/middle-east/dubai-property-test-source";
const NATIONAL_URL =
  "https://www.thenationalnews.com/business/property/abu-dhabi-test-source/";
const WHITELIST = ["reuters.com", "thenationalnews.com"];

function cluster(urls: string[], category: Cluster["suggestedCategory"] = "market-pulse"): Cluster {
  return {
    id: `recovery-${urls.length}-${category}`,
    topic: "Verified UAE property update",
    entries: urls.map((url, index) => ({
      id: `entry-${index}`,
      title: "Verified property announcement",
      url,
      publishedAt: FRESH_DATE,
      summary: "A discovery snippet that must never count as evidence: AED 999 million.",
      source: {
        name: index === 0 ? "Reuters" : "The National",
        tier: "national-press",
        domain: new URL(url).hostname.replace(/^www\./, ""),
      },
    })),
    score: 90,
    scoreBreakdown: {
      uhnwRelevance: 24,
      sourceTier: 24,
      freshness: 22,
      rajAngle: 20,
    },
    entities: {
      developers: [],
      places: ["Dubai"],
      figures: [],
      hasTier1Source: false,
    },
    suggestedCategory: category,
    suggestedMarkets: ["Dubai"],
  };
}

function bodyWithFigure(figure = "AED 10 million", analytical = false): string {
  const first = analytical
    ? `Reuters reported ${figure} in verified transactions, and we recommend investors buy only where the structural mandate remains intact.`
    : `Reuters reported ${figure} in verified transactions, establishing a structural mandate and a clear catalyst for this precinct.`;
  const sentence =
    "The release describes the mandate, absorption pattern, precinct context and secondary market mechanics in measured terms for readers assessing the underlying thesis.";
  return `${first}\n\n${Array.from({ length: 45 }, () => sentence).join(" ")}`;
}

function draftJson(input: {
  body: string;
  urls?: string[];
  title?: string;
}): string {
  return JSON.stringify({
    skip: false,
    title: input.title ?? "Verified UAE property update",
    subtitle: "A factual update based on directly fetched reporting.",
    tldr: ["Verified update", "Fresh direct source", "Evidence held to source text"],
    body: input.body,
    faq: [],
    citations: (input.urls ?? [REUTERS_URL]).map((url, index) => ({
      source: index === 0 ? "Reuters" : "The National",
      url,
    })),
  });
}

function fetched(
  url: string,
  publishedAt: string | null = FRESH_DATE,
  text =
    "Reuters reported verified transactions of AED 10 million. The direct report explains the structural mandate, catalyst, absorption and precinct context in sufficient detail.",
): FetchedArticleText {
  return {
    text,
    finalUrl: url,
    publishedAt,
    publicationDateSource: publishedAt ? "meta" : null,
    diagnostic: { code: "ok", message: `fetched ${text.length} readable characters` },
  };
}

type ResearchCall = NonNullable<NonNullable<DraftOpts["dependencies"]>["research"]>;
type RepairCall = NonNullable<NonNullable<DraftOpts["dependencies"]>["repair"]>;
type FetchCall = NonNullable<NonNullable<DraftOpts["dependencies"]>["fetchArticle"]>;

interface ReadyFixture {
  article: DraftArticle;
  provenance: NewsDraftProvenance;
}

function approvalFor(
  fixture: ReadyFixture,
  reviewer: "raj-review-session" | "deterministic-auto-publisher" =
    "deterministic-auto-publisher",
) {
  const verifiedSources = fixture.article.citations.map(
    (citation) => citation.url,
  );
  const contentHash = draftContentHash(fixture.article, fixture.provenance);
  return evidenceApprovalFor(
    1,
    contentHash,
    verifiedSources,
    fixture.provenance,
    fixture.article,
    NOW.toISOString(),
    reviewer,
  );
}

async function singleSourceTierA(): Promise<ReadyFixture> {
  let researchCalls = 0;
  let repairCalls = 0;
  const result = await draftFromCluster(cluster([REUTERS_URL]), WHITELIST, {
    now: NOW,
    dependencies: {
      research: (async () => {
        researchCalls += 1;
        return { ok: true, text: draftJson({ body: bodyWithFigure() }) };
      }) satisfies ResearchCall,
      repair: (async () => {
        repairCalls += 1;
        return { ok: false, error: "repair should not run" };
      }) satisfies RepairCall,
      fetchArticle: (async (url) => fetched(url)) satisfies FetchCall,
    },
  });
  assert.equal(result.ok, true, result.reason);
  assert.equal(result.article?.citations.length, 1);
  assert.equal(result.provenance?.fetchedEvidence?.length, 1);
  assert.equal(
    result.provenance?.fetchedEvidence?.[0]?.sourcePublishedAt,
    FRESH_DATE,
  );
  assert.equal(
    result.provenance?.fetchedEvidence?.[0]?.sourceDateSource,
    "meta",
  );
  assert.equal(
    result.provenance?.fetchedEvidence?.[0]?.freshnessCheckedAt,
    NOW.toISOString(),
  );
  assert.equal(
    result.provenance?.fetchedEvidence?.[0]?.freshnessMaxAgeHours,
    168,
  );
  assert.equal(researchCalls, 1);
  assert.equal(repairCalls, 0);

  const fixture = {
    article: result.article!,
    provenance: result.provenance!,
  };
  assert.ok(
    approvalFor(fixture),
    "one fresh Tier-A publisher must mint a content-bound evidence ledger",
  );

  const [freshEvidence] = fixture.provenance.fetchedEvidence!;
  const legacyEvidence = { ...freshEvidence };
  delete legacyEvidence.sourcePublishedAt;
  delete legacyEvidence.sourceDateSource;
  delete legacyEvidence.freshnessCheckedAt;
  delete legacyEvidence.freshnessMaxAgeHours;
  const legacy = {
    article: fixture.article,
    provenance: {
      ...fixture.provenance,
      fetchedEvidence: [legacyEvidence],
    },
  };
  assert.equal(
    approvalFor(legacy),
    null,
    "legacy evidence without immutable source-date metadata must remain manual",
  );

  const stale = {
    article: fixture.article,
    provenance: {
      ...fixture.provenance,
      fetchedEvidence: [
        {
          ...freshEvidence,
          sourcePublishedAt: "2025-11-15T08:00:00.000Z",
        },
      ],
    },
  };
  assert.equal(
    approvalFor(stale),
    null,
    "an old source cannot mint a ledger from a resurfaced story",
  );

  const future = {
    article: fixture.article,
    provenance: {
      ...fixture.provenance,
      fetchedEvidence: [
        {
          ...freshEvidence,
          sourcePublishedAt: "2026-08-16T08:00:00.000Z",
        },
      ],
    },
  };
  assert.equal(
    approvalFor(future),
    null,
    "a future-dated source cannot mint an evidence ledger",
  );

  const redirectedEvidence = {
    article: fixture.article,
    provenance: {
      ...fixture.provenance,
      fetchedEvidence: [
        {
          ...freshEvidence,
          finalUrl: NATIONAL_URL,
        },
      ],
    },
  };
  assert.equal(
    approvalFor(redirectedEvidence),
    null,
    "a cross-publisher redirect cannot mint evidence for the cited publisher",
  );

  const countEvidenceText =
    "Reuters reported AED 10 million across 7 towers in Phase 2, with 12 floors, 3 bedrooms, a 5 km corridor and 40 hectares scheduled for delivery in 2029.";
  const supportedCounts = {
    article: {
      ...fixture.article,
      title: "7 towers confirmed in the latest project update",
      subtitle: "Phase 2 contains 12 floors in the directly reported plan.",
      tldr: [
        "The plan includes 3 bedrooms.",
        "The corridor extends 5 km.",
        "Delivery is scheduled for 2029.",
      ] as [string, string, string],
      faq: [
        {
          q: "How much land is covered?",
          a: "The directly reported plan covers 40 hectares.",
        },
      ],
    },
    provenance: {
      ...fixture.provenance,
      fetchedEvidence: [
        {
          ...freshEvidence,
          text: countEvidenceText,
          contentHash: undefined,
        },
      ],
    },
  };
  assert.ok(
    approvalFor(supportedCounts),
    "exactly supported count, phase, unit and year claims must mint a ledger",
  );
  const unsupportedCount = {
    ...supportedCounts,
    article: {
      ...supportedCounts.article,
      title: supportedCounts.article.title.replace("7 towers", "8 towers"),
    },
  };
  assert.equal(
    approvalFor(unsupportedCount),
    null,
    "an unsupported material count outside the body must block the ledger",
  );

  const unsupportedAcrossFields = {
    article: {
      ...fixture.article,
      title: "AED 11 million headline claim",
      subtitle: "The subtitle claims AED 12 million.",
      tldr: [
        "The TLDR claims AED 13 million.",
        fixture.article.tldr[1],
        fixture.article.tldr[2],
      ] as [string, string, string],
      faq: [
        {
          q: "Was the value AED 14 million?",
          a: "The direct source does not support that value.",
        },
      ],
    },
    provenance: fixture.provenance,
  };
  assert.equal(
    approvalFor(unsupportedAcrossFields),
    null,
    "unsupported figures outside the body must block the ledger",
  );
  return fixture;
}

async function analysisRequiresTwoDomains(): Promise<{
  oneSource: ReadyFixture;
  twoSources: ReadyFixture;
  samePublisher: ReadyFixture;
}> {
  const analyticalBody = bodyWithFigure("AED 10 million", true);
  const oneSource = await draftFromCluster(cluster([REUTERS_URL]), WHITELIST, {
    now: NOW,
    dependencies: {
      research: (async () => ({
        ok: true,
        text: draftJson({ body: analyticalBody }),
      })) satisfies ResearchCall,
      repair: (async () => ({ ok: false, error: "must fail before repair" })) satisfies RepairCall,
      fetchArticle: (async (url) => fetched(url)) satisfies FetchCall,
    },
  });
  assert.equal(oneSource.ok, false);
  assert.match(oneSource.reason ?? "", /need 2 for corroborated-analysis/);

  const samePublisherUrl = "https://graphics.reuters.com/property/test-source";
  const samePublisher = await draftFromCluster(
    cluster([REUTERS_URL, samePublisherUrl]),
    WHITELIST,
    {
      now: NOW,
      dependencies: {
        research: (async () => ({
          ok: true,
          text: draftJson({
            body: analyticalBody,
            urls: [REUTERS_URL, samePublisherUrl],
          }),
        })) satisfies ResearchCall,
        repair: (async () => ({ ok: false, error: "must fail before repair" })) satisfies RepairCall,
        fetchArticle: (async (url) => fetched(url)) satisfies FetchCall,
      },
    },
  );
  assert.equal(samePublisher.ok, false);
  assert.match(samePublisher.reason ?? "", /only 1 fresh, directly fetched/);

  const twoSources = await draftFromCluster(
    cluster([REUTERS_URL, NATIONAL_URL]),
    WHITELIST,
    {
      now: NOW,
      dependencies: {
        research: (async () => ({
          ok: true,
          text: draftJson({
            body: analyticalBody,
            urls: [REUTERS_URL, NATIONAL_URL],
          }),
        })) satisfies ResearchCall,
        repair: (async () => ({ ok: false, error: "repair should not run" })) satisfies RepairCall,
        fetchArticle: (async (url) => fetched(url)) satisfies FetchCall,
      },
    },
  );
  assert.equal(twoSources.ok, true, twoSources.reason);
  assert.equal(twoSources.provenance?.fetchedEvidence?.length, 2);

  const twoSourceFixture = {
    article: twoSources.article!,
    provenance: twoSources.provenance!,
  };
  assert.ok(
    approvalFor(twoSourceFixture),
    "two independent approved publishers must mint an analytical ledger",
  );

  const oneSourceFixture = {
    article: {
      ...twoSourceFixture.article,
      slug: "2026-08-16-one-source-analysis",
      citations: [twoSourceFixture.article.citations[0]],
      heroImage: {
        ...twoSourceFixture.article.heroImage,
        src: "/news/2026-08-16-one-source-analysis/cover.jpg" as const,
      },
    },
    provenance: {
      ...twoSourceFixture.provenance,
      clusterId: "one-source-analysis",
      fetchedEvidence: [twoSourceFixture.provenance.fetchedEvidence![0]],
    },
  };
  assert.equal(
    approvalFor(oneSourceFixture),
    null,
    "one publisher cannot mint an analytical/disputed ledger",
  );

  const secondCitation = twoSourceFixture.article.citations[1];
  const secondEvidence = twoSourceFixture.provenance.fetchedEvidence![1];
  const samePublisherFixture = {
    article: {
      ...twoSourceFixture.article,
      slug: "2026-08-16-same-publisher-analysis",
      citations: [
        twoSourceFixture.article.citations[0],
        { ...secondCitation, source: "Reuters Graphics", url: samePublisherUrl },
      ],
      heroImage: {
        ...twoSourceFixture.article.heroImage,
        src: "/news/2026-08-16-same-publisher-analysis/cover.jpg" as const,
      },
    },
    provenance: {
      ...twoSourceFixture.provenance,
      clusterId: "same-publisher-analysis",
      fetchedEvidence: [
        twoSourceFixture.provenance.fetchedEvidence![0],
        {
          ...secondEvidence,
          url: samePublisherUrl,
          finalUrl: samePublisherUrl,
        },
      ],
    },
  };
  assert.equal(
    approvalFor(samePublisherFixture),
    null,
    "Reuters subdomains cannot masquerade as independent publishers",
  );

  return {
    oneSource: oneSourceFixture,
    twoSources: twoSourceFixture,
    samePublisher: samePublisherFixture,
  };
}

async function disputedMarketClaimsRequireTwoDomains(): Promise<void> {
  const disputedBody = bodyWithFigure().replace(
    "establishing a structural mandate and a clear catalyst for this precinct",
    "while the market-wide claim remains disputed, despite the structural mandate and catalyst for this precinct",
  );
  const oneSource = await draftFromCluster(cluster([REUTERS_URL]), WHITELIST, {
    now: NOW,
    dependencies: {
      research: (async () => ({
        ok: true,
        text: draftJson({ body: disputedBody }),
      })) satisfies ResearchCall,
      repair: (async () => ({ ok: false, error: "must fail before repair" })) satisfies RepairCall,
      fetchArticle: (async (url) => fetched(url)) satisfies FetchCall,
    },
  });
  assert.equal(oneSource.ok, false);
  assert.match(oneSource.reason ?? "", /need 2 for corroborated-analysis/);

  const twoSources = await draftFromCluster(
    cluster([REUTERS_URL, NATIONAL_URL]),
    WHITELIST,
    {
      now: NOW,
      dependencies: {
        research: (async () => ({
          ok: true,
          text: draftJson({
            body: disputedBody,
            urls: [REUTERS_URL, NATIONAL_URL],
          }),
        })) satisfies ResearchCall,
        repair: (async () => ({ ok: false, error: "repair should not run" })) satisfies RepairCall,
        fetchArticle: (async (url) => fetched(url)) satisfies FetchCall,
      },
    },
  );
  assert.equal(twoSources.ok, true, twoSources.reason);
  const twoSourceFixture = {
    article: twoSources.article!,
    provenance: twoSources.provenance!,
  };
  assert.ok(
    approvalFor(twoSourceFixture),
    "two independent publishers must support a disputed market-wide ledger",
  );

  const oneSourceFixture = {
    article: {
      ...twoSourceFixture.article,
      slug: "2026-08-16-one-source-disputed-market-claim",
      citations: [twoSourceFixture.article.citations[0]],
      heroImage: {
        ...twoSourceFixture.article.heroImage,
        src: "/news/2026-08-16-one-source-disputed-market-claim/cover.jpg" as const,
      },
    },
    provenance: {
      ...twoSourceFixture.provenance,
      clusterId: "one-source-disputed-market-claim",
      fetchedEvidence: [twoSourceFixture.provenance.fetchedEvidence![0]],
    },
  };
  assert.equal(
    approvalFor(oneSourceFixture),
    null,
    "edited or legacy one-source disputed claims must remain manual",
  );
}

async function crossPublisherRedirectIsHeld(): Promise<void> {
  const result = await draftFromCluster(cluster([REUTERS_URL]), WHITELIST, {
    now: NOW,
    dependencies: {
      research: (async () => ({
        ok: true,
        text: draftJson({ body: bodyWithFigure() }),
      })) satisfies ResearchCall,
      repair: (async () => ({ ok: false, error: "repair must not run" })) satisfies RepairCall,
      fetchArticle: (async (url) => ({
        ...fetched(url),
        finalUrl: NATIONAL_URL,
      })) satisfies FetchCall,
    },
  });
  assert.equal(result.ok, false);
  assert.match(result.reason ?? "", /only 0 fresh, directly fetched/);
  assert.ok(
    result.diagnostics?.some((entry) =>
      /publisher identity mismatch/.test(entry),
    ),
  );
}

async function fetchCompletionClockIsStored(): Promise<void> {
  const draftClock = new Date("2026-08-15T22:00:00.000Z");
  const sourcePublished = "2026-08-15T22:05:00.000Z";
  const fetchCompleted = new Date("2026-08-15T22:10:00.000Z");
  const clockValues = [draftClock, fetchCompleted];
  const result = await draftFromCluster(cluster([REUTERS_URL]), WHITELIST, {
    dependencies: {
      clock: () => {
        const value = clockValues.shift();
        if (!value) throw new Error("clock read more than twice");
        return value;
      },
      research: (async () => ({
        ok: true,
        text: draftJson({ body: bodyWithFigure() }),
      })) satisfies ResearchCall,
      repair: (async () => ({ ok: false, error: "repair should not run" })) satisfies RepairCall,
      fetchArticle: (async (url) =>
        fetched(url, sourcePublished)) satisfies FetchCall,
    },
  });
  assert.equal(result.ok, true, result.reason);
  assert.equal(result.article?.publishedAt, draftClock.toISOString());
  assert.equal(
    result.provenance?.fetchedEvidence?.[0]?.fetchedAt,
    fetchCompleted.toISOString(),
  );
  assert.equal(
    result.provenance?.fetchedEvidence?.[0]?.freshnessCheckedAt,
    fetchCompleted.toISOString(),
  );
  assert.equal(clockValues.length, 0);
}

async function storageUsesSameEvidencePolicy(
  tierA: ReadyFixture,
  analysis: { oneSource: ReadyFixture; twoSources: ReadyFixture },
): Promise<void> {
  const originalDirectory = process.cwd();
  const testDirectory = await fs.mkdtemp(
    path.join(os.tmpdir(), "iwr-evidence-ledger-"),
  );
  const originalKvUrl = process.env.KV_REST_API_URL;
  const originalKvToken = process.env.KV_REST_API_TOKEN;
  process.env.KV_REST_API_URL = "";
  process.env.KV_REST_API_TOKEN = "";

  try {
    process.chdir(testDirectory);
    const storage = await import("../lib/news-review/storage.js");
    let fixtureNumber = 0;

    const stageAndVerify = async (
      fixture: ReadyFixture,
      reviewer: "raj-review-session" | "deterministic-auto-publisher",
    ) => {
      fixtureNumber += 1;
      const slug = `${fixture.article.slug}-storage-${fixtureNumber}`;
      const staged = await storage.addDraft({
        ...fixture,
        article: {
          ...fixture.article,
          slug,
          heroImage: { ...fixture.article.heroImage, src: `/news/${slug}/cover.jpg` },
        },
      });
      return storage.updateReviewedDraft(
        staged.id,
        {
          verifiedSources: staged.article.citations.map(
            (citation) => citation.url,
          ),
        },
        {
          revision: staged.revision,
          recordVersion: staged.recordVersion,
          contentHash: staged.contentHash,
        },
        { evidenceReviewer: reviewer },
      );
    };

    const manualTierA = await stageAndVerify(tierA, "raj-review-session");
    assert.equal(manualTierA?.evidenceApproval?.reviewer, "raj-review-session");

    const automatedAnalysis = await stageAndVerify(
      analysis.twoSources,
      "deterministic-auto-publisher",
    );
    assert.equal(
      automatedAnalysis?.evidenceApproval?.reviewer,
      "deterministic-auto-publisher",
    );

    const heldAnalysis = await stageAndVerify(
      analysis.oneSource,
      "raj-review-session",
    );
    assert.equal(
      heldAnalysis?.evidenceApproval,
      undefined,
      "manual storage review must not mint approval for a one-publisher analysis",
    );
  } finally {
    process.chdir(originalDirectory);
    if (originalKvUrl === undefined) delete process.env.KV_REST_API_URL;
    else process.env.KV_REST_API_URL = originalKvUrl;
    if (originalKvToken === undefined) delete process.env.KV_REST_API_TOKEN;
    else process.env.KV_REST_API_TOKEN = originalKvToken;
    await fs.rm(testDirectory, { recursive: true, force: true });
  }
}

async function staleAndUnknownDatesHold(): Promise<void> {
  for (const [label, publishedAt, diagnostic] of [
    ["stale", "2025-11-15T08:00:00.000Z", /maximum 168h/],
    ["unknown", null, /publication date missing/],
  ] as const) {
    let repairCalls = 0;
    const result = await draftFromCluster(cluster([REUTERS_URL]), WHITELIST, {
      now: NOW,
      dependencies: {
        research: (async () => ({
          ok: true,
          text: draftJson({ body: bodyWithFigure() }),
        })) satisfies ResearchCall,
        repair: (async () => {
          repairCalls += 1;
          return { ok: false, error: "repair must not launder stale evidence" };
        }) satisfies RepairCall,
        fetchArticle: (async (url) => fetched(url, publishedAt)) satisfies FetchCall,
      },
    });
    assert.equal(result.ok, false, `${label} source must be held`);
    assert.match(result.reason ?? "", /only 0 fresh, directly fetched/);
    assert.ok(result.diagnostics?.some((entry) => diagnostic.test(entry)));
    assert.equal(repairCalls, 0);
  }
}

async function unsupportedFiguresNeverPass(): Promise<void> {
  let repairCalls = 0;
  let repairPrompt = "";
  const unsupportedBody = bodyWithFigure("AED 99 million");
  const result = await draftFromCluster(cluster([REUTERS_URL]), WHITELIST, {
    now: NOW,
    dependencies: {
      research: (async () => ({
        ok: true,
        text: draftJson({ body: unsupportedBody }),
      })) satisfies ResearchCall,
      repair: (async (request) => {
        repairCalls += 1;
        repairPrompt = String(request.messages[0]?.content ?? "");
        return {
          ok: true,
          text: draftJson({ body: unsupportedBody }),
        };
      }) satisfies RepairCall,
      fetchArticle: (async (url) => fetched(url)) satisfies FetchCall,
    },
  });
  assert.equal(result.ok, false);
  assert.match(result.reason ?? "", /retained 1 unsupported figure/);
  assert.match(repairPrompt, /AED 99 million/i);
  assert.match(repairPrompt, /AED 10 million/i);
  assert.equal(repairCalls, 1, "evidence repair must be capped at one call");
}

async function repairFixesMechanicalGates(): Promise<void> {
  let repairCalls = 0;
  let repairPrompt = "";
  const badBody =
    "This amazing release offers a brief property update without a quantified opening.";
  const repairedBody = bodyWithFigure();
  const result = await draftFromCluster(cluster([REUTERS_URL]), WHITELIST, {
    now: NOW,
    dependencies: {
      research: (async () => ({
        ok: true,
        text: draftJson({ body: badBody }),
      })) satisfies ResearchCall,
      repair: (async (request) => {
        repairCalls += 1;
        repairPrompt = String(request.messages[0]?.content ?? "");
        return {
          ok: true,
          text: draftJson({ body: repairedBody }),
        };
      }) satisfies RepairCall,
      fetchArticle: (async (url) => fetched(url)) satisfies FetchCall,
    },
  });
  assert.equal(result.ok, true, result.reason);
  assert.equal(repairCalls, 1);
  assert.match(repairPrompt, /Banned lexicon/);
  assert.match(repairPrompt, /Approved lexicon/);
  assert.match(repairPrompt, /P1 has a number/);
  assert.match(repairPrompt, /Word count/);
  assert.match(repairPrompt, /EXPLICIT SUPPORTED FIGURES[\s\S]*AED 10 million/i);
}

async function generationRetryIsCapped(): Promise<void> {
  const requests: Parameters<ResearchCall>[0][] = [];
  const recoveryResponses = [
    { ok: true as const, text: "" },
    { ok: true as const, text: draftJson({ body: bodyWithFigure() }) },
  ];
  const recovered = await draftFromCluster(cluster([REUTERS_URL]), WHITELIST, {
    now: NOW,
    dependencies: {
      research: (async (request) => {
        requests.push(request);
        return recoveryResponses.shift() ?? { ok: false, error: "unexpected third call" };
      }) satisfies ResearchCall,
      repair: (async () => ({ ok: false, error: "repair should not run" })) satisfies RepairCall,
      fetchArticle: (async (url) => fetched(url)) satisfies FetchCall,
    },
  });
  assert.equal(recovered.ok, true, recovered.reason);
  assert.equal(requests.length, 2);
  assert.equal(requests[1].maxSearches, 1);
  assert.match(String(requests[1].messages.at(-1)?.content ?? ""), /empty output/);

  let unparseableCalls = 0;
  const held = await draftFromCluster(cluster([REUTERS_URL]), WHITELIST, {
    now: NOW,
    dependencies: {
      research: (async () => {
        unparseableCalls += 1;
        return { ok: true, text: "not a JSON draft" };
      }) satisfies ResearchCall,
      repair: (async () => ({ ok: false, error: "repair should not run" })) satisfies RepairCall,
      fetchArticle: (async () => {
        throw new Error("fetch should not run for unparseable output");
      }) satisfies FetchCall,
    },
  });
  assert.equal(held.ok, false);
  assert.equal(unparseableCalls, 2);
  assert.match(held.reason ?? "", /unparseable JSON after 1 bounded retry/);
}

async function snippetsNeverBecomeEvidence(): Promise<void> {
  let repairCalls = 0;
  const body = bodyWithFigure().replace(
    "AED 10 million",
    '<cite index="1">AED 10 million</cite>',
  );
  const result = await draftFromCluster(cluster([REUTERS_URL]), WHITELIST, {
    now: NOW,
    dependencies: {
      research: (async () => ({
        ok: true,
        text: draftJson({ body }),
        searchedUrls: [REUTERS_URL],
      })) satisfies ResearchCall,
      repair: (async () => {
        repairCalls += 1;
        return { ok: false, error: "repair must not run without evidence" };
      }) satisfies RepairCall,
      fetchArticle: (async () => ({
        text: "",
        finalUrl: null,
        publishedAt: null,
        publicationDateSource: null,
        diagnostic: { code: "http", message: "Source request failed (403)." },
      })) satisfies FetchCall,
    },
  });
  assert.equal(result.ok, false);
  assert.match(result.reason ?? "", /only 0 fresh, directly fetched/);
  assert.ok(result.diagnostics?.some((entry) => /403/.test(entry)));
  assert.equal(repairCalls, 0);
}

function publicationDateExtraction(): void {
  const meta = extractPublicationDate(
    '<meta content="2026-08-15T12:00:00+04:00" property="article:published_time">',
  );
  assert.deepEqual(meta, {
    publishedAt: "2026-08-15T08:00:00.000Z",
    source: "meta",
  });

  const jsonLd = extractPublicationDate(
    '<script type="application/ld+json">{"@graph":[{"@type":"NewsArticle","datePublished":"2026-08-14T10:30:00Z"}]}</script>',
  );
  assert.deepEqual(jsonLd, {
    publishedAt: "2026-08-14T10:30:00.000Z",
    source: "json-ld",
  });

  const time = extractPublicationDate(
    '<time class="published" datetime="2026-08-13">13 August 2026</time>',
  );
  assert.deepEqual(time, {
    publishedAt: "2026-08-13T00:00:00.000Z",
    source: "time",
  });
  assert.deepEqual(
    extractPublicationDate(
      '<meta property="article:modified_time" content="2026-08-15T12:00:00Z"><time class="updated" datetime="2026-08-15">today</time>',
    ),
    { publishedAt: null, source: null },
  );

  const jsonBody = "A direct structured article body with AED 10 million and enough explanatory words to exceed the fallback threshold. ".repeat(3);
  assert.equal(
    extractMainText(
      `<script type="application/ld+json">${JSON.stringify({
        "@type": "NewsArticle",
        articleBody: jsonBody,
      })}</script>`,
    ),
    jsonBody.trim(),
  );

  assert.equal(
    assessPublicationFreshness("2025-11-15T08:00:00.000Z", NOW).status,
    "stale",
  );
  assert.equal(assessPublicationFreshness(null, NOW).status, "unknown");
  assert.equal(assessPublicationFreshness(FRESH_DATE, NOW).status, "fresh");
}

async function protectedFetchDiagnostics(): Promise<void> {
  const insecure = await fetchArticleText("http://www.reuters.com/article", {
    allowedDomains: ["reuters.com"],
    timeoutMs: 1_000,
  });
  assert.equal(insecure.diagnostic.code, "blocked-url");
  assert.match(insecure.diagnostic.message, /approved HTTPS host boundary/);

  const privateAddress = await fetchArticleText("https://127.0.0.1/article", {
    allowedDomains: ["127.0.0.1"],
    timeoutMs: 1_000,
  });
  assert.equal(privateAddress.diagnostic.code, "blocked-url");
  assert.match(privateAddress.diagnostic.message, /non-public address/);
}

async function main(): Promise<void> {
  publicationDateExtraction();
  await protectedFetchDiagnostics();
  const tierA = await singleSourceTierA();
  const analysis = await analysisRequiresTwoDomains();
  await disputedMarketClaimsRequireTwoDomains();
  await crossPublisherRedirectIsHeld();
  await fetchCompletionClockIsStored();
  await storageUsesSameEvidencePolicy(tierA, analysis);
  await staleAndUnknownDatesHold();
  await unsupportedFiguresNeverPass();
  await repairFixesMechanicalGates();
  await generationRetryIsCapped();
  await snippetsNeverBecomeEvidence();
  console.log(
    "Newsroom recovery regression passed: fresh evidence lanes, repair/retry caps, figure safety and publication dates are enforced.",
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
