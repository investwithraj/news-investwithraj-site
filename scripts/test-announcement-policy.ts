import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { approvedPublisherIdentity, articleEvidenceSegments, assessDraft, determineEvidencePolicy } from "../lib/news-review/auto-approve";
import { draftFromCluster } from "../lib/news-review/draft-engine";
import { draftContentHash, evidenceApprovalFor, reassessEvidenceApproval, validateDraftArticleShape } from "../lib/news-review/integrity";
import { CURRENT_EVIDENCE_POLICY_VERSION, type DraftArticle, type NewsDraft, type NewsDraftProvenance } from "../lib/news-review/types";
import { serializeArticle } from "../lib/news-review/serialize";
import { validateDraft } from "../lib/voice/validator";
import type { Cluster } from "../lib/pipeline/types";

const NOW = new Date("2026-09-10T08:00:00.000Z");
const sourceUrl = "https://www.wam.ae/en/article/c256iib-dubai-developers-launch-multi-billion-dirham";
// Exact source paragraphs supplied by the independent source review. No requests.
const sourceText = `Hussein Ezz Eddin, Chief Sales Officer at Prestige One Developments, said the company plans to invest AED3 billion to AED4 billion during the 2026-2027 property season through land acquisitions and new residential and commercial projects in key locations across Dubai.
He said the company has launched four projects since the beginning of the year and plans to launch a further seven to eight during the current season.`;
const title = "Prestige One plans to invest AED3 billion to AED4 billion";
// Repetitive only to isolate the 80-word fixture; not a publication candidate.
const body = "Hussein Ezz Eddin, the Chief Sales Officer of Prestige One Developments, told WAM the company plans to invest AED3 billion to AED4 billion for the 2026-2027 property season. Prestige One plans new residential and commercial projects in Dubai. Prestige One plans land acquisitions and new commercial projects across key locations in Dubai. Prestige One plans to invest through land acquisitions and new residential and commercial projects across Dubai. Prestige One plans to launch a further seven to eight projects during the current season.";
const publisher = approvedPublisherIdentity(sourceUrl)!;
const article: DraftArticle = {
  slug: "2026-09-10-prestige-one-investment-plans-fixture", title,
  subtitle: "Prestige One plans new residential and commercial projects in Dubai.",
  publishedAt: NOW.toISOString(), modifiedAt: NOW.toISOString(), displayDate: "10 Sep 2026",
  author: "raj-tomar", tier: "news", format: "short-update", category: "developer-corporate", market: ["Dubai"],
  reportingBasis: { sourceUrl, speaker: "Hussein Ezz Eddin", organization: "Prestige One Developments", statementKind: "corporate-intent" },
  tldr: [title, "Prestige One plans new residential and commercial projects in Dubai.", "Prestige One plans to launch a further seven to eight projects during the current season."],
  body, faq: [], citations: [{ source: publisher.name, tier: publisher.tier, url: sourceUrl, accessedAt: NOW.toISOString() }],
  heroImage: { src: "/news/2026-09-10-prestige-one-investment-plans-fixture/cover.jpg", alt: title, credit: "To be set at review" },
  cta: { href: "https://www.investwithraj.com/engage", label: "Get the institutional read — work with Raj" }, distribution: {},
};
const provenance: NewsDraftProvenance = {
  clusterId: "announcement-policy-fixture", topic: title, score: 80,
  scoreBreakdown: { uhnwRelevance: 20, sourceTier: 20, freshness: 20, rajAngle: 20 },
  sources: [{ name: publisher.name, tier: publisher.tier, url: sourceUrl, summary: "Discovery is not evidence." }],
  fetchedEvidence: [{ url: sourceUrl, finalUrl: sourceUrl, text: sourceText, fetchedAt: NOW.toISOString(),
    contentHash: createHash("sha256").update(sourceText).digest("hex"), sourcePublishedAt: "2026-09-09T08:00:00.000Z",
    sourceDateSource: "publisher-api", freshnessCheckedAt: NOW.toISOString(), freshnessMaxAgeHours: 168 }],
};
const assess = (candidate = article, evidence = provenance) => assessDraft({ id: "announcement-fixture", article: candidate,
  validator: validateDraft(candidate), provenance: evidence, createdAt: NOW.toISOString() }, { autoPublicationAt: NOW });

async function main() {
  assert.equal(CURRENT_EVIDENCE_POLICY_VERSION, 5);
  const imageContext = { ...article, slug: "2026-09-10-prestige-one-dubai-investment-plan", heroImage: {
    src: "/news/2026-09-10-prestige-one-dubai-investment-plan/cover.jpg",
    alt: "Dubai skyline at sunset, shown as city context",
    credit: "Invest With Raj stock-account archive; Dubai city context, not a Prestige One project",
  } };
  assert.equal(articleEvidenceSegments(imageContext).some(({ field }) => field === "heroImage.alt"), false);
  for (const candidate of [
    { ...imageContext, slug: "different-story" },
    { ...imageContext, heroImage: { ...imageContext.heroImage, src: "/news/different-story/cover.jpg" } },
    { ...imageContext, heroImage: { ...imageContext.heroImage, credit: "Unverified credit" } },
    { ...imageContext, heroImage: { ...imageContext.heroImage, alt: "Prestige One completed this project" } },
  ]) assert.equal(articleEvidenceSegments(candidate).some(({ field }) => field === "heroImage.alt"), true);
  assert.equal(validateDraftArticleShape(article).ok, true);
  assert.equal(validateDraft(article).ok, true, JSON.stringify(validateDraft(article).failures));
  const positive = assess();
  assert.equal(positive.verdict, "auto-approve", positive.reasons.join("; "));
  assert.equal(positive.evidenceLane, "attributed-announcement");
  assert.equal(positive.requiredPublisherCount, 1);
  assert.equal(determineEvidencePolicy(article, [sourceUrl]).requiredPublisherCount, 2,
    "URLs or model metadata without directly fetched evidence cannot enter the announcement lane");
  const withoutBasis = { ...article }; delete withoutBasis.reportingBasis;
  assert.equal(assess(withoutBasis).verdict, "manual");
  for (const basis of [null, {}, { ...article.reportingBasis, speaker: "" },
    { ...article.reportingBasis, statementKind: "forecast" }, { ...article.reportingBasis, extra: true },
    { ...article.reportingBasis, sourceUrl: "https://www.wam.ae/" },
    { ...article.reportingBasis, sourceUrl: "https://evil.example/story" }]) {
    const candidate = { ...article, reportingBasis: basis } as unknown as DraftArticle;
    assert.equal(validateDraftArticleShape(candidate).ok, false);
    assert.equal(assess(candidate).verdict, "manual");
  }
  for (const candidate of [{ ...article, format: "long-report" as const }, { ...article, format: undefined },
    { ...article, category: "market-pulse" as const }]) {
    assert.equal(validateDraftArticleShape(candidate).ok, false);
    assert.equal(assess(candidate).verdict, "manual");
  }
  for (const patch of [
    { reportingBasis: { ...article.reportingBasis!, speaker: "Another Person" } },
    { reportingBasis: { ...article.reportingBasis!, organization: "Another Developer" } },
    { body: body.replace("plans to invest", "has invested") },
    { body: `${body} Prestige One expects buyer demand to increase.` },
    { body: `${body} Prestige One promises guaranteed investment returns.` },
    { subtitle: "Prestige One plans to invest AED9 billion to AED10 billion" },
    { body: sourceText },
  ]) {
    const result = assess({ ...article, ...patch });
    assert.equal(result.verdict, "manual", JSON.stringify(patch));
  }
  // Independent review counterexamples: each previously reached auto-approve.
  // Re-hash every synthetic source mutation so a stale integrity hash or voice
  // failure cannot conceal the semantic regression being tested.
  for (const counterexample of [
    { label: "reserved subject marker", source: sourceText,
      body: `${body} BoundCorporation plans new residential and commercial projects in Dubai.` },
    { label: "company noun after another company's context",
      source: `${sourceText}\nUnion Properties opened its exhibition in Dubai.`,
      body: `${body} Union Properties introduced the Dubai exhibition. The developer plans new residential and commercial projects in Dubai.` },
    { label: "omitted approval contingency",
      source: sourceText.replace("across Dubai.", "across Dubai, subject to regulatory approval."), body },
    { label: "omitted if-approved contingency",
      source: sourceText.replace("plans to invest", "plans to invest, if approved,"), body },
  ]) {
    const candidate = { ...article, body: counterexample.body };
    const evidence = structuredClone(provenance);
    evidence.fetchedEvidence![0].text = counterexample.source;
    evidence.fetchedEvidence![0].contentHash = createHash("sha256").update(counterexample.source).digest("hex");
    const result = assess(candidate, evidence);
    assert.equal(result.gatesOk, true, `${counterexample.label}: voice should still pass`);
    assert.equal(result.verdict, "manual", counterexample.label);
    assert.ok(result.unsupportedClaimCount > 0, `${counterexample.label}: source matching must hold`);
    assert.equal(evidenceApprovalFor(1, draftContentHash(candidate, evidence), [sourceUrl], evidence,
      candidate, NOW.toISOString(), "deterministic-auto-publisher"), null, counterexample.label);
    console.log(`Review counterexample held: ${counterexample.label}`);
  }
  const stale = structuredClone(provenance);
  stale.fetchedEvidence![0].sourcePublishedAt = "2026-08-01T00:00:00.000Z";
  assert.equal(assess(article, stale).verdict, "manual");
  const absent = { ...provenance, fetchedEvidence: [] };
  assert.equal(assess(article, absent).verdict, "manual");
  const redirected = structuredClone(provenance);
  redirected.fetchedEvidence![0].finalUrl = "https://www.reuters.com/world/example";
  assert.equal(assess(article, redirected).verdict, "manual");

  const hash = draftContentHash(article, provenance);
  for (const patch of [{ sourceUrl: "https://www.wam.ae/en/article/different" }, { speaker: "Another Person" },
    { organization: "Another Company" }, { statementKind: "not-corporate-intent" }]) {
    assert.notEqual(draftContentHash({ ...article, reportingBasis: { ...article.reportingBasis, ...patch } } as DraftArticle, provenance), hash);
  }
  assert.match(serializeArticle(article), /"reportingBasis"/u);
  const approval = evidenceApprovalFor(1, hash, [sourceUrl], provenance, article, NOW.toISOString(), "deterministic-auto-publisher");
  assert.ok(approval);
  const draft = { id: "announcement-fixture", article, provenance, revision: 1, contentHash: hash,
    verifiedSources: [sourceUrl], evidenceApproval: approval } as NewsDraft;
  assert.ok(reassessEvidenceApproval(draft));
  const old = { ...draft, evidenceApproval: { ...approval, policyVersion: 4 } } as unknown as NewsDraft;
  assert.equal(reassessEvidenceApproval(old), null, "Old policy approvals are not silently valid");
  assert.ok(evidenceApprovalFor(1, hash, [sourceUrl], provenance, article, NOW.toISOString(), "deterministic-auto-publisher"),
    "The same bound article can be reminted only after all current gates pass");
  const unsafe = { ...article, body: `${body} Prestige One expects demand to double.` };
  assert.equal(evidenceApprovalFor(1, draftContentHash(unsafe, provenance), [sourceUrl], provenance, unsafe, NOW.toISOString(), "deterministic-auto-publisher"), null);
  const tampered = structuredClone(provenance);
  tampered.fetchedEvidence![0].text = sourceText.replace("AED3", "AED8");
  assert.equal(evidenceApprovalFor(1, draftContentHash(article, tampered), [sourceUrl], tampered, article, NOW.toISOString()), null,
    "A stale evidence hash rejects changed source text");
  const route = readFileSync("app/api/news/draft/[id]/publish/route.ts", "utf8");
  assert.match(route, /const alreadyPrepared =[\s\S]{0,500}Boolean\(reassessEvidenceApproval\(draft\)\)/u);
  const mediaGuard = route.indexOf("assertNewPublicationMediaApproval(draft)", route.indexOf("const recomputedEvidence"));
  assert.ok(mediaGuard > route.indexOf("const recomputedEvidence"));
  assert.ok(mediaGuard > route.indexOf('stage = "media-validation"'));
  assert.ok(mediaGuard < route.indexOf("await claimDraftPublication(id"));
  const assessorSource = readFileSync("lib/news-review/auto-approve.ts", "utf8");
  const mediaHelper = assessorSource.slice(assessorSource.indexOf("export function assertNewPublicationMediaApproval"),
    assessorSource.indexOf("export function selectAutoApproveEligibleDrafts"));
  assert.match(mediaHelper, /assertRequiredCuratedMediaApproval\(draft\)/u,
    "The shared new-publication guard must retain the exact Prestige media check");
  assert.match(route, /error instanceof CuratedMediaReuseError[\s\S]{0,130}privateJson\(\{ error: error.message \}, error.status\)/u);

  const cluster: Cluster = { id: "announcement-policy-fixture", topic: title, entries: [{ id: "fixture", title, url: sourceUrl,
    publishedAt: "2026-09-09T08:00:00.000Z", summary: "Untrusted discovery", source: { name: publisher.name, tier: publisher.tier, domain: publisher.domain } }],
    score: 80, scoreBreakdown: provenance.scoreBreakdown,
    entities: { developers: ["Prestige One"], places: ["Dubai"], figures: [], hasTier1Source: true },
    suggestedCategory: "developer-corporate", suggestedMarkets: ["Dubai"] };
  let providerCalls = 0;
  const result = await draftFromCluster(cluster, [publisher.domain], { format: "short-update", now: NOW,
    dependencies: {
      research: async (request) => { providerCalls++; assert.match(request.system ?? "", /reportingBasis/u);
        return { ok: true, text: JSON.stringify(article), searchedUrls: [sourceUrl] }; },
      repair: async () => ({ ok: true, text: JSON.stringify(article) }),
      fetchArticle: async () => ({ text: sourceText, finalUrl: sourceUrl, publishedAt: "2026-09-09T08:00:00.000Z",
        publicationDateSource: "publisher-api", diagnostic: { code: "ok", message: "fixture" } }),
    } });
  assert.equal(result.ok, true, `${result.reason}; ${result.diagnostics?.join("; ")}`);
  assert.deepEqual(result.article?.reportingBasis, article.reportingBasis);
  assert.deepEqual(result.article?.speakableSelector, [".article-body > p:first-child"]);
  assert.equal(providerCalls, 1);
  // A repair can edit copy but cannot create, replace or remove the source-bound
  // announcement identity. Omission is intentional: the server retains it.
  for (const [mode, candidate, expected] of [
    ["omitted", undefined, true],
    ["identical", article.reportingBasis, true],
    ["null", null, false],
    ["changed", { ...article.reportingBasis, speaker: "Another Person" }, false],
  ] as const) {
    let repairs = 0;
    const repaired = await draftFromCluster(cluster, [publisher.domain], {
      format: "short-update", now: NOW,
      dependencies: {
        research: async () => ({ ok: true, text: JSON.stringify({ ...article,
          title: "Prestige One grants permanent residency to every buyer" }), searchedUrls: [sourceUrl] }),
        repair: async (request) => {
          repairs++;
          assert.match(request.system ?? "", /omit reportingBasis entirely/u);
          assert.doesNotMatch(request.system ?? "", /Include reportingBasis exactly/u);
          return { ok: true, text: JSON.stringify({ ...article, reportingBasis: candidate }) };
        },
        fetchArticle: async () => ({ text: sourceText, finalUrl: sourceUrl,
          publishedAt: "2026-09-09T08:00:00.000Z", publicationDateSource: "publisher-api",
          diagnostic: { code: "ok", message: "fixture" } }),
      },
    });
    assert.ok(repairs > 0, `${mode} must exercise repair`);
    assert.equal(repaired.ok, expected, `${mode}: ${repaired.reason}`);
    if (expected) assert.deepEqual(repaired.article?.reportingBasis, article.reportingBasis);
    else assert.match(repaired.reason ?? "", /cannot replace or invent reportingBasis/u);
  }
  console.log("Announcement policy passed: source-bound short reporting, typed scope, current-policy approvals, invalid/misleading/copied/stale holds, hash binding and drafting round-trip. No external operations.");
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
