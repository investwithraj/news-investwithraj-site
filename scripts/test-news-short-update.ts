import assert from "node:assert/strict";

import { buildCitations, draftFromCluster, draftSystemPrompt, type DraftOpts } from "../lib/news-review/draft-engine.js";
import { approvedPublisherIdentity, assessDraft } from "../lib/news-review/auto-approve.js";
import { draftContentHash, evidenceApprovalFor, validateDraftArticleShape } from "../lib/news-review/integrity.js";
import { serializeArticle } from "../lib/news-review/serialize.js";
import type { DraftArticle } from "../lib/news-review/types.js";
import type { Cluster } from "../lib/pipeline/types.js";
import { validateDraft } from "../lib/voice/validator.js";

const NOW = new Date("2026-09-10T08:00:00.000Z");
const SOURCE_DATE = "2026-09-09T08:00:00.000Z";
const URL = "https://dubailand.gov.ae/en/news/short-update-fixture";
// Synthetic fixtures only: no external requests, live articles or provider calls.
const paragraphs = [
  "Dubai Land Department confirmed its registration service update. Dubai Land Department published revised registration guidance for the applicable procedure.",
  "Dubai Land Department stated the applicable implementation terms for its registration service. Dubai Land Department confirmed the official registration process in its published announcement.",
  "Dubai Land Department published its direct service announcement for the updated registration procedure. Dubai Land Department stated the official implementation timetable for the new service.",
  "Dubai Land Department published applicable service fees in the updated registration guidance. Dubai Land Department confirmed the registration procedure covers applicable contracts and official records.",
  "Dubai Land Department stated the implementation terms include the updated transaction process and regulatory service. Dubai Land Department published its own registration service guidance. Dubai Land Department confirmed the revised regulatory timetable for its registration services.",
];
const BODY = paragraphs.join("\n\n");
const EVIDENCE = [
  "Dubai Land Department confirmed an updated registration service framework in its official record.",
  "Dubai Land Department published the revised registration guidance for its applicable procedure.",
  "Dubai Land Department stated its applicable implementation terms for the registration service.",
  "Dubai Land Department confirmed its official registration process in the published announcement.",
  "Dubai Land Department published a direct service announcement for its updated registration procedure.",
  "Dubai Land Department stated its official implementation timetable for a new service.",
  "Dubai Land Department published the applicable service fees in its updated registration guidance.",
  "Dubai Land Department confirmed its registration procedure covers the applicable contracts and official records.",
  "Dubai Land Department stated its implementation terms include an updated transaction process and the regulatory service.",
  "Dubai Land Department published the official registration service guidance through its direct channel.",
  "Dubai Land Department confirmed its revised regulatory timetable for the registration services.",
].join(" ");
const json = (body: string) => JSON.stringify({
  title: "Dubai Land Department confirms its registration service update",
  subtitle: "Dubai Land Department published its own registration service guidance.",
  tldr: [
    "Dubai Land Department confirmed its registration service update.",
    "Dubai Land Department published its own registration service guidance.",
    "Dubai Land Department stated the applicable implementation terms.",
  ],
  body,
  faq: [],
  citations: [{ source: "Dubai Land Department", url: URL }],
});
const cluster: Cluster = {
  id: "short-update-fixture",
  topic: "Dubai Land Department registration service update",
  entries: [{
    id: "fixture-entry", title: "Registration service update", url: URL,
    publishedAt: SOURCE_DATE, summary: "Discovery text is not evidence.",
    source: { name: "Dubai Land Department", tier: "government", domain: "dubailand.gov.ae" },
  }],
  score: 80,
  scoreBreakdown: { uhnwRelevance: 20, sourceTier: 20, freshness: 20, rajAngle: 20 },
  entities: { developers: [], places: ["Dubai"], figures: [], hasTier1Source: true },
  suggestedCategory: "regulatory", suggestedMarkets: ["Dubai"],
};

async function generate(body: string, options: {
  format?: DraftOpts["format"];
  source?: string;
  date?: string | null;
  badTitle?: string;
  repairBasis?: unknown;
  repairBasisAt?: number;
  numericRepair?: boolean;
  semanticRepair?: "first-unsupported" | "always-unsupported";
  repairErrorAt?: number;
} = {}) {
  const prompts: string[] = [];
  const researchMessages: string[] = [];
  let repairs = 0;
  const result = await draftFromCluster(cluster, ["dubailand.gov.ae"], {
    format: options.format,
    now: NOW,
    dependencies: {
      research: async (request) => {
        prompts.push(request.system ?? "");
        researchMessages.push(...request.messages.map((message) => message.content));
        const draft = JSON.parse(json(body));
        if (options.badTitle) draft.title = options.badTitle;
        return { ok: true, text: JSON.stringify(draft), searchedUrls: [URL] };
      },
      repair: async (request) => {
        prompts.push(request.system ?? "");
        repairs++;
        if (options.repairErrorAt === repairs) return { ok: false, error: "fixture provider unavailable" };
        const copy = JSON.parse(json(body));
        if (options.numericRepair && repairs === 1) copy.body += " Dubai Land Department confirmed a fee of AED 999 million.";
        if (options.semanticRepair === "always-unsupported" || (options.semanticRepair === "first-unsupported" && repairs === 1)) {
          copy.title = "Dubai Land Department grants permanent residency to every applicant";
        }
        if (options.repairBasis !== undefined && (options.repairBasisAt === undefined || options.repairBasisAt === repairs)) {
          copy.reportingBasis = options.repairBasis;
        }
        return { ok: true, text: JSON.stringify(copy) };
      },
      fetchArticle: async () => ({
        text: options.source ?? EVIDENCE, finalUrl: URL,
        publishedAt: options.date === undefined ? SOURCE_DATE : options.date,
        publicationDateSource: options.date === null ? null : "meta",
        diagnostic: { code: "ok", message: "test fixture" },
      }),
    },
  });
  return { result, prompts, researchMessages, repairs };
}

async function main() {
  for (const [domain, publisher, path] of [
    ["gulfnews.com", "Gulf News", "/business/corporate-news/allegiance-real-estate-claims-three-honours-at-the-damac-awards-h1-2026-1.500669757"],
    ["thenationalnews.com", "The National", "/business/property/2026/09/09/dubai-holding-awards-its-largest-construction-contract-worth-dh5-billion/"],
    ["khaleejtimes.com", "Khaleej Times", "/real-estate/test-source-fixture"],
    ["zawya.com", "Zawya", "/en/business/real-estate/test-source-fixture"],
  ]) {
    const url = `https://${domain}${path}`;
    assert.equal(approvedPublisherIdentity(url)?.name, publisher);
    const citations = buildCitations([{ source: "Model-invented feed label", url }], cluster, [domain], NOW.toISOString());
    assert.equal(citations[0]?.source, publisher, "Attribution is registry-owned, not model-owned.");
  }
  assert.equal(approvedPublisherIdentity("https://gulfnews.com.evil.example/story"), null);
  const { result, prompts, researchMessages } = await generate(BODY, { format: "short-update" });
  assert.equal(researchMessages.length, 1);
  assert.equal(researchMessages[0].split("\n")[0], `RESEARCH DATE: ${NOW.toISOString()}`,
    "Research must receive the current injected clock, not the source's older publication date.");
  assert.match(researchMessages[0], /first look for the exact canonical government, regulator or developer release/u);
  assert.match(researchMessages[0], /Prefer that primary publication when its facts support the short update/u);
  assert.match(researchMessages[0], /do not inflate the source list with duplicate reporting/u);
  assert.match(researchMessages[0], /higher-risk reporting still require two independently supporting approved publisher domains/u);
  assert.match(researchMessages[0], /exact named speaker must state the plan in the source, not merely express personal sentiment/u);
  assert.match(prompts[0], /personal feelings, a historical result or the reporter's project description does NOT establish corporate intent/u);
  assert.match(prompts[0], /explicitly binds that named speaker and company to an actual plan/u);
  assert.equal(result.ok, true, `${result.reason}; ${result.diagnostics?.join("; ")}`);
  assert.ok(result.article && result.provenance);
  const article = result.article;
  assert.equal(article.format, "short-update");
  assert.equal(article.body, BODY, "short mode must not insert a compulsory numerical lead");
  const voice = validateDraft(article);
  assert.equal(voice.ok, true, JSON.stringify(voice.failures));
  assert.equal(voice.metrics.p1HasNumber, false);
  assert.ok(voice.metrics.approvedLexiconCount < 3);
  assert.ok(voice.metrics.wordCount >= 80 && voice.metrics.wordCount <= 500);
  assert.equal(prompts.length, 1, "valid short update needs no length/jargon repair");
  const titleRepair = await generate(BODY, { format: "short-update",
    badTitle: "Dubai Land Department grants permanent residency to every applicant" });
  assert.equal(titleRepair.result.ok, true, titleRepair.result.reason);
  assert.ok(titleRepair.prompts.length > 1, "An unsupported non-numeric title must enter repair.");
  assert.match(titleRepair.prompts[1], /If any listed claim-support, validator or numeric failure concerns the title, rewrite it/u);
  assert.doesNotMatch(titleRepair.prompts[1], /Preserve the current title unless the unsupported or unparsed lists identify numerical/u);
  assert.equal(titleRepair.result.article?.title, article.title,
    "The corrected title must pass the unchanged final source check.");
  const semanticRepair = await generate(BODY, { format: "short-update",
    badTitle: "Dubai Land Department grants permanent residency to every applicant",
    semanticRepair: "first-unsupported" });
  assert.equal(semanticRepair.result.ok, true, semanticRepair.result.reason);
  assert.equal(semanticRepair.repairs, 2);
  assert.equal(semanticRepair.prompts.length, 3, "Source alignment gets research plus at most two prose repairs.");
  assert.match(semanticRepair.prompts[2], /final source-alignment correction/u);
  assert.equal(semanticRepair.result.article?.title, article.title);
  assert.ok(semanticRepair.result.diagnostics?.some((line) => /final source-alignment repair invoked/u.test(line)));
  const stillUnsupported = await generate(BODY, { format: "short-update",
    badTitle: "Dubai Land Department grants permanent residency to every applicant",
    semanticRepair: "always-unsupported" });
  assert.equal(stillUnsupported.result.ok, false, "A bounded retry cannot waive final factual support.");
  assert.equal(stillUnsupported.repairs, 2);
  assert.equal(stillUnsupported.prompts.length, 3, "Unsupported repairs must not create an endless retry loop.");
  assert.match(stillUnsupported.result.reason ?? "", /not anchor-supported/u);
  for (const repairErrorAt of [1, 2]) {
    const failedProvider = await generate(BODY, { format: "short-update",
      badTitle: "Dubai Land Department grants permanent residency to every applicant",
      semanticRepair: "first-unsupported", repairErrorAt });
    assert.equal(failedProvider.result.ok, false);
    assert.equal(failedProvider.repairs, repairErrorAt, "Provider errors must not trigger another provider call.");
    assert.equal(failedProvider.prompts.length, repairErrorAt + 1);
    assert.match(failedProvider.result.reason ?? "", /fixture provider unavailable/u);
  }
  const finalBasisMutation = await generate(BODY, { format: "short-update",
    badTitle: "Dubai Land Department grants permanent residency to every applicant",
    semanticRepair: "first-unsupported", repairBasisAt: 2,
    repairBasis: { sourceUrl: URL, speaker: "Invented Speaker", organization: "Invented Company", statementKind: "corporate-intent" } });
  assert.equal(finalBasisMutation.result.ok, false);
  assert.equal(finalBasisMutation.repairs, 2, "The basis-mutation regression must exercise the final repair.");
  assert.match(finalBasisMutation.result.reason ?? "", /cannot replace or invent reportingBasis/u);
  const numericRepair = await generate(BODY, { format: "short-update",
    badTitle: "Dubai Land Department grants permanent residency to every applicant", numericRepair: true });
  assert.equal(numericRepair.result.ok, true, numericRepair.result.reason);
  assert.equal(numericRepair.prompts.length, 3, "Exercise research, evidence repair and numeric repair.");
  for (const prompt of numericRepair.prompts.slice(1)) {
    assert.match(prompt, /omit reportingBasis entirely/u);
    assert.doesNotMatch(prompt, /Include reportingBasis exactly/u);
  }
  assert.equal(numericRepair.result.article?.reportingBasis, undefined);
  const inventedBasis = await generate(BODY, { format: "short-update",
    badTitle: "Dubai Land Department grants permanent residency to every applicant",
    repairBasis: { sourceUrl: URL, speaker: "Invented Speaker", organization: "Invented Company", statementKind: "corporate-intent" } });
  assert.equal(inventedBasis.result.ok, false);
  assert.match(inventedBasis.result.reason ?? "", /cannot replace or invent reportingBasis/u);
  assert.doesNotMatch(prompts[0], /650\+|800[–-]1100|analytical register \(≥3\)/u);
  assert.match(draftSystemPrompt(), /650\+/u, "legacy prompt remains long-form");
  assert.equal(validateDraftArticleShape(article).ok, true);
  for (const origin of ["https://investwithraj.com", "https://www.investwithraj.com"]) {
    assert.equal(validateDraftArticleShape({ ...article, cta: { ...article.cta, href: `${origin}/engage?utm_source=news` } }).ok, true);
  }
  for (const href of ["https://foreign.example/engage", "https://www.investwithraj.com.foreign.example/engage", "https://www.investwithraj.com/other", "http://www.investwithraj.com/engage"]) {
    assert.equal(validateDraftArticleShape({ ...article, cta: { ...article.cta, href } }).ok, false);
  }
  const hash = draftContentHash(article, result.provenance);
  assert.notEqual(hash, draftContentHash({ ...article, format: "long-report" }, result.provenance));
  assert.match(serializeArticle(article), /"format": "short-update"/u);
  const assessment = assessDraft({
    id: "short-update-test", createdAt: NOW.toISOString(), article,
    validator: voice, provenance: result.provenance,
  }, { autoPublicationAt: NOW });
  assert.equal(assessment.verdict, "auto-approve", assessment.reasons.join("; "));
  assert.ok(evidenceApprovalFor(1, hash, [URL], result.provenance, article,
    NOW.toISOString(), "deterministic-auto-publisher"));
  const pressUrl = "https://www.reuters.com/world/middle-east/short-update-fixture";
  const pressArticle = { ...article, citations: [{ ...article.citations[0], source: "Reuters", url: pressUrl }] };
  const onePressAssessment = assessDraft({
    id: "short-press-test", article: pressArticle, validator: validateDraft(pressArticle),
    provenance: {
      ...result.provenance,
      fetchedEvidence: result.provenance.fetchedEvidence?.map((evidence) => ({ ...evidence, url: pressUrl, finalUrl: pressUrl })),
    },
  });
  assert.equal(onePressAssessment.requiredPublisherCount, 2);
  assert.equal(onePressAssessment.verdict, "manual", "short mode cannot turn one press publisher into the official-fact lane");

  const legacy = { ...article };
  delete legacy.format;
  assert.equal(validateDraft(legacy).ok, false, "omitting mode cannot bypass long-form gates");
  assert.equal(validateDraft({ ...article, format: "long-report" }).ok, false);
  assert.equal(validateDraft({ ...article, tier: "insight" }).ok, false);
  assert.equal(validateDraftArticleShape({ ...article, format: "anything" }).ok, false);
  assert.equal(validateDraftArticleShape({ ...article, format: null }).ok, false);
  assert.equal(validateDraftArticleShape({ ...article, semaform: { theTake: "A brief analysis." } }).ok, false);
  assert.equal(validateDraft({ ...article, body: "Short but incomplete." }).ok, false);
  assert.equal(validateDraft({ ...article, body: `${BODY} `.repeat(5) }).ok, false);

  const editorialBody = `${BODY}\n\nADGM records licence and entity measures separately. ADGM's active licence total reached 13,974. ADGM's operational entity count reached 3,986. ADGM's fund total reached 276. ADGM's manager total reached 190. These licence and entity measures should remain separate in this analysis.`;
  const editorialEvidence = `${EVIDENCE} ADGM records active licences and operational entities as separate measures. ADGM's active licence total reached 13,974. ADGM's operational entity count reached 3,986. ADGM's fund total reached 276. ADGM's manager total reached 190.`;
  const editorialArticle = { ...article, body: editorialBody };
  const editorialProvenance = {
    ...result.provenance,
    fetchedEvidence: result.provenance.fetchedEvidence?.map((evidence) => ({ ...evidence, text: editorialEvidence })),
  };
  const editorialAssessment = assessDraft({
    id: "short-editorial-test", createdAt: NOW.toISOString(), article: editorialArticle,
    validator: validateDraft(editorialArticle), provenance: editorialProvenance,
  });
  assert.ok(editorialAssessment.reasons.some((reason) => /short-update format permits source-supported facts only/u.test(reason)),
    editorialAssessment.reasons.join("; "));
  const editorialGeneration = await generate(editorialBody, { format: "short-update", source: editorialEvidence });
  assert.equal(editorialGeneration.result.ok, false);
  assert.match(editorialGeneration.result.reason ?? "", /Short updates permit source-supported facts only/u);

  const unsupported = await generate(`${BODY}\n\nDubai Land Department confirmed a registration fee of AED 999 million.`, { format: "short-update" });
  assert.equal(unsupported.result.ok, false, "short format cannot bypass numeric/claim evidence");
  assert.match(unsupported.result.reason ?? "", /unsupported|not anchor-supported|unparsed/u);
  for (const prompt of unsupported.prompts) {
    assert.doesNotMatch(prompt, /650\+|800[–-]1100|at least three approved analytical-register/u);
  }
  const copied = await generate(`${BODY}\n\n${EVIDENCE}`, { format: "short-update" });
  assert.equal(copied.result.ok, false, "copying source sentences remains held");
  assert.match(`${copied.result.reason} ${copied.result.diagnostics?.join(" ")}`, /source-copying/u);
  const unsupportedClaim = await generate(`${BODY}\n\nDubai Land Department confirmed that every applicant received permanent residency.`, { format: "short-update" });
  assert.equal(unsupportedClaim.result.ok, false);
  assert.match(unsupportedClaim.result.reason ?? "", /not anchor-supported/u);
  const stale = await generate(BODY, { format: "short-update", date: "2026-08-01T00:00:00.000Z" });
  assert.equal(stale.result.ok, false, "short format cannot bypass source recency");
  const undated = await generate(BODY, { format: "short-update", date: null });
  assert.equal(undated.result.ok, false, "short format cannot use undated evidence");
  const invalid = await generate(BODY, { format: "other" as DraftArticle["format"] });
  assert.equal(invalid.result.ok, false);
  assert.equal(invalid.prompts.length, 0, "invalid mode fails before paid research");
  console.log("Short-update regression passed: explicit format, concise factual publication, unchanged evidence/number/date/originality gates, no legacy bypass.");
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
