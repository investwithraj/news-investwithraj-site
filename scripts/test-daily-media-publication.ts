import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import { NextRequest } from "next/server";
import ts from "typescript";

import * as assessor from "../lib/news-review/auto-approve";
import * as integrity from "../lib/news-review/integrity";
import * as mutation from "../lib/security/mutation";
import { getCuratedNewsCandidate } from "../lib/news-review/curated-candidates";
import { CuratedMediaReuseError } from "../lib/news-review/curated-media";
import { DailyMediaReuseError, reuseApprovedDailyMedia } from "../lib/news-review/daily-media";
import { expectedDailyMediaFields, withDailyNewsMedia } from "../lib/news-review/daily-media-catalog";
import type { MediaApprovalLedger, NewsDraft, NewsDraftProvenance } from "../lib/news-review/types";
import { validateDraft, type DraftArticle as VoiceArticle } from "../lib/voice/validator";

const NOW = new Date("2026-09-10T19:00:00.000Z");
const SOURCE_TEXT = "Hussein Ezz Eddin, Chief Sales Officer at Prestige One Developments, said the company plans to invest AED3 billion to AED4 billion during the 2026-2027 property season through land acquisitions and new residential and commercial projects in key locations across Dubai. He said the company has launched four projects since the beginning of the year and plans to launch a further seven to eight during the current season.";

function fixture(index = 1): NewsDraft {
  const candidate = structuredClone(getCuratedNewsCandidate("prestige-one-investment-2026-09-10"));
  const article = withDailyNewsMedia({ ...candidate.article,
    slug: `2026-09-10-daily-media-regression-${index}`,
    publishedAt: new Date(NOW.getTime() - index * 60_000).toISOString(),
    modifiedAt: NOW.toISOString(),
  });
  const provenance: NewsDraftProvenance = {
    clusterId: `daily-test-${index}`, topic: article.title, score: 90,
    scoreBreakdown: { uhnwRelevance: 25, sourceTier: 25, freshness: 20, rajAngle: 20 },
    sources: article.citations.map((citation) => ({ name: citation.source, tier: "government", url: citation.url, summary: SOURCE_TEXT })),
    fetchedEvidence: article.citations.map((citation) => ({
      url: citation.url, finalUrl: citation.url, text: SOURCE_TEXT,
      contentHash: createHash("sha256").update(SOURCE_TEXT).digest("hex"),
      fetchedAt: NOW.toISOString(), sourcePublishedAt: "2026-09-10T18:00:00.000Z",
      sourceDateSource: "publisher-api", freshnessCheckedAt: NOW.toISOString(), freshnessMaxAgeHours: 168,
    })),
  };
  const draft: NewsDraft = {
    id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    createdAt: NOW.toISOString(), updatedAt: NOW.toISOString(), status: "review",
    article, provenance, validator: validateDraft(article as unknown as VoiceArticle),
    revision: 1, recordVersion: 1, contentHash: integrity.draftContentHash(article, provenance),
    verifiedSources: article.citations.map((citation) => citation.url),
  };
  draft.evidenceApproval = integrity.evidenceApprovalFor(1, draft.contentHash, draft.verifiedSources!, provenance, article, NOW.toISOString(), "deterministic-auto-publisher") ?? undefined;
  assert.equal(integrity.validateDraftArticleShape(article).ok, true, JSON.stringify(integrity.validateDraftArticleShape(article)));
  assert.equal(integrity.validateProvenanceShape(provenance, draft.verifiedSources!).ok, true, JSON.stringify(integrity.validateProvenanceShape(provenance, draft.verifiedSources!)));
  const assessment = assessor.assessDraft(draft, { autoPublicationAt: NOW });
  assert.equal(assessment.verdict, "auto-approve", assessment.reasons.join("; "));
  assert.ok(draft.evidenceApproval);
  return draft;
}

function approved(draft: NewsDraft, human = false): NewsDraft {
  const fields = expectedDailyMediaFields(draft.article);
  assert.ok(fields);
  const record: Omit<MediaApprovalLedger, "hash"> = {
    revision: draft.revision, contentHash: draft.contentHash,
    ...fields, approvedAt: NOW.toISOString(),
  };
  if (human) { record.reviewer = "raj-review-session"; delete record.reuseReceipt; }
  return { ...draft, mediaApproval: { ...record, hash: integrity.mediaApprovalHash(record) } };
}

async function workerTest(initial: NewsDraft[], options: { review?: boolean; failReuse?: boolean; staleRefresh?: boolean } = {}) {
  let drafts = structuredClone(initial);
  const requests: Array<{ url: string; method: string; body: Record<string, unknown> }> = [];
  const originalFetch = globalThis.fetch;
  let preparations = 0;
  try {
    globalThis.fetch = async (input, init) => {
      const url = new URL(String(input));
      const method = init?.method ?? "GET";
      const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
      requests.push({ url: url.href, method, body });
      if (url.pathname === "/api/news/draft" && !url.search) return Response.json({ drafts });
      if (url.pathname === "/api/news/draft" && url.searchParams.has("id")) {
        const draft = drafts.find((entry) => entry.id === url.searchParams.get("id"));
        assert.ok(draft);
        return Response.json({ ok: true, draft: options.staleRefresh ? { ...draft, recordVersion: draft.recordVersion + 1 } : draft });
      }
      const match = url.pathname.match(/^\/api\/news\/draft\/([^/]+)\/(reuse-daily-media|publish)$/u);
      assert.ok(match, `Unexpected network request: ${url.href}`);
      assert.equal(method, "POST");
      const draft = drafts.find((entry) => entry.id === match[1]);
      assert.ok(draft);
      if (match[2] === "publish") {
        assessor.assertNewPublicationMediaApproval(draft);
        assert.equal(body.expectedRevision, draft.revision);
        assert.equal(body.expectedRecordVersion, draft.recordVersion);
        assert.equal(body.expectedContentHash, draft.contentHash);
        return Response.json({ claimId: "00000000-0000-4000-8000-999999999999", commitSha: "a".repeat(40) }, { status: 202 });
      }
      preparations += 1;
      if (options.failReuse) return Response.json({ error: "mock image service unavailable" }, { status: 503 });
      const fields = expectedDailyMediaFields(draft.article)!;
      const inspected = { repoPath: fields.repoPath, contentSha256: fields.contentSha256, mime: fields.mime, width: fields.width, height: fields.height };
      const updated = await reuseApprovedDailyMedia(draft.id, body, {
        getDraft: async (id) => structuredClone(drafts.find((entry) => entry.id === id) ?? null),
        ensureApprovedDailyMediaCover: async () => inspected,
        inspectEditorialMedia: async () => inspected,
        setMediaApproval: async (id, approval, expected) => {
          const current = drafts.find((entry) => entry.id === id)!;
          assert.deepEqual(expected, { revision: current.revision, recordVersion: current.recordVersion, contentHash: current.contentHash });
          assert.equal(current.mediaApproval, undefined);
          const next = { ...current, mediaApproval: approval, recordVersion: current.recordVersion + 1 };
          drafts = drafts.map((entry) => entry.id === id ? next : entry);
          return next;
        },
        now: () => NOW.toISOString(),
      });
      return Response.json({ ok: true, mediaApproval: updated.mediaApproval, revision: updated.revision, recordVersion: updated.recordVersion, contentHash: updated.contentHash });
    };
    const result = await assessor.runAutoApprove({ site: "https://news.example.invalid", secret: "offline-test", publish: !options.review,
      publishLimit: 1, now: NOW, deploymentAttempts: 0, log: () => undefined });
    return { result, requests, preparations };
  } finally { globalThis.fetch = originalFetch; }
}

async function testWorker(): Promise<void> {
  const first = fixture();
  const second = fixture(2);
  const third = fixture(3);
  const normal = await workerTest([first, second, third]);
  assert.equal(normal.result.published, 1);
  assert.equal(normal.preparations, 1);
  assert.equal(normal.result.deferred, 2, "Do not prepare the whole backlog");
  assert.equal(normal.requests.filter((request) => request.url.includes("?id=")).length, 1);
  const review = await workerTest([first], { review: true });
  assert.equal(review.result.published, 0);
  assert.equal(review.preparations, 0);
  assert.equal(review.requests.length, 1, "Review-only has no mutation or media attachment");

  const missingContext = structuredClone(first);
  missingContext.article.heroImage.alt = "";
  missingContext.contentHash = integrity.draftContentHash(missingContext.article, missingContext.provenance);
  const nextReady = await workerTest([missingContext, approved(second, true)]);
  assert.equal(nextReady.result.published, 1, "Image-less draft must not consume the publication slot");
  assert.equal(nextReady.result.held, 1);
  assert.equal(nextReady.preparations, 0, "Valid human image approval must not be rewritten");
  assert.deepEqual(nextReady.result.publishedSlugs, [second.article.slug]);
  assert.equal(nextReady.result.holdReasonCounts["media-approval"], 1);
  const failedPreparation = await workerTest([first, second, approved(third)], { failReuse: true });
  assert.equal(failedPreparation.preparations, 1, "Failed preparation must not trigger unbounded asset writes");
  assert.equal(failedPreparation.result.published, 1, "An already-ready later draft remains eligible");
  assert.deepEqual(failedPreparation.result.publishedSlugs, [third.article.slug]);
  const stale = await workerTest([first], { staleRefresh: true });
  assert.equal(stale.result.held, 1);
  assert.equal(stale.result.published, 0);
  assert.equal(stale.requests.some((request) => request.url.endsWith("/publish")), false);
  const existing = approved(first);
  existing.mediaApproval!.contentSha256 = "0".repeat(64);
  assert.throws(() => assessor.assertNewPublicationMediaApproval(existing), /media approval/u);
  assert.equal((await workerTest([existing])).result.published, 0);

  // Media-only fixtures verify open-licence records; their changed news claims
  // are deliberately never sent through the worker or publication route.
  const abuDhabi = fixture(4);
  abuDhabi.article = withDailyNewsMedia({ ...abuDhabi.article, market: ["Abu Dhabi"],
    body: abuDhabi.article.body.replaceAll("Dubai", "Abu Dhabi") });
  abuDhabi.contentHash = integrity.draftContentHash(abuDhabi.article, abuDhabi.provenance);
  const openStock = approved(abuDhabi);
  assert.equal(openStock.mediaApproval!.reviewer, "approved-open-stock-reuse");
  assert.doesNotThrow(() => assessor.assertNewPublicationMediaApproval(openStock));
  const alteredOpenReceipt = structuredClone(openStock);
  alteredOpenReceipt.mediaApproval!.reuseReceipt!.id = "unregistered-open-stock";
  const { hash: oldHash, ...alteredRecord } = alteredOpenReceipt.mediaApproval!;
  assert.ok(oldHash);
  alteredOpenReceipt.mediaApproval!.hash = integrity.mediaApprovalHash(alteredRecord);
  assert.throws(() => assessor.assertNewPublicationMediaApproval(alteredOpenReceipt), /changed, stale or bound/u);

  assert.equal(assessor.articleEvidenceSegments(first.article).some((segment) => segment.field === "heroImage.alt"), false);
  const invented = structuredClone(first.article);
  invented.heroImage.alt = "Prestige One has completed this tower and delivered guaranteed returns";
  assert.ok(assessor.articleEvidenceSegments(invented).some((segment) => segment.field === "heroImage.alt"));
  const modified = { ...first, article: invented };
  assert.equal(assessor.assessDraft(modified, { autoPublicationAt: NOW }).verdict, "manual");
}

async function testPublishRoute(): Promise<void> {
  const routeSource = await readFile(new URL("../app/api/news/draft/[id]/publish/route.ts", import.meta.url), "utf8");
  const compiled = ts.transpileModule(routeSource, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  let current = fixture();
  let archived: NewsDraft | null = null;
  let commits = 0;
  let claims = 0;
  let lastCommitMedia: MediaApprovalLedger | null | undefined;
  class Conflict extends Error {}
  // Run the actual lineage validator against a mocked immutable archive. A
  // caller-supplied correctionOf must not act as permission to omit an image.
  const correctionSource = await readFile(new URL("../lib/news-review/correction.ts", import.meta.url), "utf8");
  const correctionCode = ts.transpileModule(correctionSource, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  const correctionExports: Record<string, unknown> = {};
  const correctionDependencies: Record<string, unknown> = {
    "node:crypto": { createHash }, "@/lib/news-review/auto-approve": assessor,
    "@/lib/news-review/integrity": integrity,
    "@/lib/news-review/storage": { getArchivedPublicationDraft: async (id: string) => archived?.id === id ? structuredClone(archived) : null },
  };
  runInNewContext(correctionCode, { exports: correctionExports,
    require: (id: string) => { assert.ok(id in correctionDependencies, `Unexpected correction dependency: ${id}`); return correctionDependencies[id]; },
    Date, console }, { timeout: 2_000 });
  const dependencies: Record<string, unknown> = {
    "next/server": { NextRequest }, "@/content/news": { NEWS_ARTICLES: [] },
    "@/lib/dubai-time": { dubaiCalendarDate: () => "2026-09-10" },
    "@/lib/news-review/auto-approve": assessor,
    "@/lib/news-review/auth": { authorizeMutation: async () => ({ ok: true, credential: "server-secret" }), authorize: async () => ({ ok: true, credential: "server-secret" }) },
    "@/lib/news-review/correction": correctionExports,
    "@/lib/news-review/curated-media": { CuratedMediaReuseError },
    "@/lib/news-review/daily-media": { DailyMediaReuseError },
    "@/lib/news-review/github": { githubConfigured: () => true, publishArticleCommit: async (_slug: string, _article: unknown, media: MediaApprovalLedger | null) => { commits += 1; lastCommitMedia = media; return "a".repeat(40); } },
    "@/lib/news-review/duplicate-guard": { findRecentLiveArticleDuplicate: () => null, NewsDuplicateHoldError: class extends Error {} },
    "@/lib/news-review/integrity": integrity,
    "@/lib/news-review/publication-diagnostic": { publicationFailureDiagnostic: () => ({ code: "unexpected-test-failure" }) },
    "@/lib/news-review/storage": {
      getDraft: async () => structuredClone(current), DraftConflictError: Conflict,
      getStorageBackend: () => "test", validateArticle: (article: VoiceArticle) => validateDraft(article),
      updateReviewedDraft: async () => { throw new Error("Fixture should already have valid evidence approval"); },
      claimDraftPublication: async () => {
        claims += 1;
        return { acquired: true, draft: { ...current, publication: { state: "publishing", claimId: "00000000-0000-4000-8000-777777777777" } } };
      },
      recordDraftPublicationCommit: async () => undefined,
    },
    "@/lib/news-scheduler/day": {}, "@/lib/news-scheduler/publication-day-ledger": {},
    "@/lib/security/mutation": mutation,
  };
  type RouteFunction = (req: NextRequest, context: { params: Promise<{ id: string }> }) => Promise<Response>;
  const exports: { POST?: RouteFunction; GET?: RouteFunction } = {};
  class FixedDate extends Date { constructor(value?: string | number) { super(value ?? NOW.getTime()); } static now() { return NOW.getTime(); } }
  runInNewContext(compiled, { exports, require: (id: string) => { assert.ok(id in dependencies, `Unexpected dependency: ${id}`); return dependencies[id]; },
    process: { env: {} }, Date: FixedDate, console, TextEncoder, URL, Response }, { timeout: 2_000 });
  assert.ok(exports.POST);
  const invoke = (body: Record<string, unknown> = {}) => exports.POST!(new NextRequest(`https://news.example.invalid/api/news/draft/${current.id}/publish`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  }), { params: Promise.resolve({ id: current.id }) });
  const missing = await invoke();
  assert.equal(missing.status, 422, await missing.clone().text());
  assert.match((await missing.json()).error, /approved image/u);
  assert.equal(claims, 0); assert.equal(commits, 0);
  current = approved(fixture());
  const changed = await invoke({ expectedRevision: 1, expectedRecordVersion: 2, expectedContentHash: current.contentHash });
  assert.equal(changed.status, 409);
  const incomplete = await invoke({ expectedRevision: 1 });
  assert.equal(incomplete.status, 400);
  const ready = await invoke({ expectedRevision: 1, expectedRecordVersion: 1, expectedContentHash: current.contentHash });
  assert.equal(ready.status, 202, await ready.clone().text());
  assert.equal(commits, 1); assert.equal(claims, 1);

  current = fixture();
  current.publication = {
    state: "committed", evidencePolicyVersion: current.evidenceApproval!.policyVersion,
    claimId: "00000000-0000-4000-8000-777777777777", revision: current.revision,
    contentHash: current.contentHash, mediaApprovalHash: integrity.WITHHELD_MEDIA_APPROVAL_HASH,
    evidenceApprovalHash: current.evidenceApproval!.hash, startedAt: NOW.toISOString(), updatedAt: NOW.toISOString(),
    commitSha: "a".repeat(40), url: `https://news.example.invalid/news/${current.article.slug}`,
  };
  const recovery = await invoke();
  assert.equal(recovery.status, 202, await recovery.clone().text());
  assert.equal((await recovery.json()).idempotent, true, "Old committed text-only publication recovery is not retroactively blocked");
  assert.equal(commits, 1); assert.equal(claims, 1);

  archived = { ...structuredClone(current), publication: { ...current.publication!, state: "completed" } };
  const correction = structuredClone(archived);
  delete correction.publication;
  correction.id = "correction-offline-regression";
  correction.revision = 2;
  correction.article.modifiedAt = "2026-09-10T19:05:00.000Z";
  correction.article.correction = { correctedAt: correction.article.modifiedAt, summary: "Clarified that the investment is planned." };
  correction.correctionOf = { draftId: archived.id, revision: archived.revision, contentHash: archived.contentHash, commitSha: archived.publication!.commitSha! };
  correction.contentHash = integrity.draftContentHash(correction.article, correction.provenance);
  correction.validator = validateDraft(correction.article as unknown as VoiceArticle);
  correction.evidenceApproval = integrity.evidenceApprovalFor(correction.revision, correction.contentHash,
    correction.verifiedSources!, correction.provenance, correction.article, NOW.toISOString(), "deterministic-auto-publisher") ?? undefined;
  assert.ok(correction.evidenceApproval);
  current = { ...correction, correctionOf: { ...correction.correctionOf!, commitSha: "b".repeat(40) } };
  const forged = await invoke();
  assert.ok(forged.status >= 400, "Forged completed-publication lineage cannot waive the image requirement");
  assert.equal(commits, 1); assert.equal(claims, 1);
  assert.ok(exports.GET);
  const readCapability = () => exports.GET!(new NextRequest(`https://news.example.invalid/api/news/draft/${current.id}/publish`),
    { params: Promise.resolve({ id: current.id }) });
  const forgedCapability = await readCapability();
  assert.ok((await forgedCapability.json()).blockers.includes("correction-lineage-hold"));
  current = correction;
  const correctionCapability = await readCapability();
  assert.equal((await correctionCapability.json()).ok, true, "Verified text-only historical correction has an accurate read-only capability report");
  const corrected = await invoke({ expectedRevision: current.revision, expectedRecordVersion: current.recordVersion, expectedContentHash: current.contentHash });
  assert.equal(corrected.status, 202, await corrected.clone().text());
  assert.equal(lastCommitMedia, null, "Existing correction Git protections receive no added image");
  assert.equal(commits, 2); assert.equal(claims, 2);
  const ordinaryWorker = await workerTest([{ ...correction, id: fixture(9).id }]);
  assert.equal(ordinaryWorker.result.published, 0, "The normal unattended worker cannot use the historical correction exception");
  assert.equal(ordinaryWorker.preparations, 0, "The normal worker must not attach an image to a historical text-only correction");
}

async function main(): Promise<void> {
  await testWorker();
  await testPublishRoute();
  console.log("Daily media publication regression passed: exact photo context, bounded preparation, read-only review, ready-draft selection, stale refresh and CAS rejection, mandatory new-story images, committed recovery and archive-proven historical corrections.");
}
main().catch((error) => { console.error(error); process.exit(1); });
