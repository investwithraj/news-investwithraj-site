import assert from "node:assert/strict";

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

const NOW = new Date("2026-08-16T12:00:00.000Z");
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

async function singleSourceTierA(): Promise<void> {
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
  assert.equal(researchCalls, 1);
  assert.equal(repairCalls, 0);
}

async function analysisRequiresTwoDomains(): Promise<void> {
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
  await singleSourceTierA();
  await analysisRequiresTwoDomains();
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
