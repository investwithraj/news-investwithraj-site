import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { NextRequest } from "next/server";

import { getCuratedNewsCandidate } from "../lib/news-review/curated-candidates";
import { hasApprovedCuratedMediaContext } from "../lib/news-review/curated-media-context";
import {
  assertRequiredCuratedMediaApproval,
  CuratedMediaReuseError,
  ensureCuratedMediaApproval,
  parseCuratedMediaReuseRequest,
  PRESTIGE_ONE_CONTEXT_MEDIA as binding,
  reuseApprovedCuratedMedia,
  type CuratedMediaReuseDependencies,
  type CuratedMediaReuseRequest,
} from "../lib/news-review/curated-media";
import { draftContentHash, mediaApprovalHash } from "../lib/news-review/integrity";
import { createReviewSession } from "../lib/news-review/session";
import type { NewsDraft, NewsDraftProvenance } from "../lib/news-review/types";
import { validateDraft, type DraftArticle as VoiceDraftArticle } from "../lib/voice/validator";

function fixture(): NewsDraft {
  const candidate = getCuratedNewsCandidate(binding.candidateKey);
  const provenance: NewsDraftProvenance = {
    clusterId: `curated:${candidate.key}`,
    topic: candidate.topic,
    score: 100,
    scoreBreakdown: { uhnwRelevance: 25, sourceTier: 25, freshness: 25, rajAngle: 25 },
    sources: candidate.article.citations.map((citation) => ({
      name: citation.source,
      tier: citation.tier ?? "government",
      url: citation.url,
      summary: candidate.article.body,
    })),
  };
  return {
    id: binding.draftId,
    createdAt: "2026-09-10T20:00:00.000Z",
    updatedAt: "2026-09-10T20:00:00.000Z",
    status: "review",
    article: candidate.article,
    provenance,
    validator: validateDraft(candidate.article as unknown as VoiceDraftArticle),
    revision: 1,
    recordVersion: 1,
    contentHash: draftContentHash(candidate.article, provenance),
  };
}

function requestFor(draft: NewsDraft): CuratedMediaReuseRequest {
  return {
    candidateKey: binding.candidateKey,
    expectedRevision: draft.revision,
    expectedRecordVersion: draft.recordVersion,
    expectedContentHash: draft.contentHash,
  };
}

function memoryStore(initial = fixture()) {
  let current = structuredClone(initial);
  let writes = 0;
  let inspections = 0;
  let inspectHook = () => {};
  let beforeWrite = () => {};
  const inspected = {
    repoPath: binding.repoPath,
    contentSha256: binding.contentSha256,
    mime: binding.mime as "image/jpeg" | "image/png" | "image/webp",
    width: binding.width as number,
    height: binding.height as number,
  };
  const dependencies: CuratedMediaReuseDependencies = {
    getDraft: async () => structuredClone(current),
    inspectEditorialMedia: async (slug) => {
      assert.equal(slug, binding.slug);
      inspections += 1;
      inspectHook();
      return { ...inspected };
    },
    setMediaApproval: async (id, approval, expected) => {
      assert.equal(id, binding.draftId);
      beforeWrite();
      if (current.revision !== expected.revision ||
        current.recordVersion !== expected.recordVersion ||
        current.contentHash !== expected.contentHash || current.publication) {
        throw new Error("CAS conflict");
      }
      assert.equal(current.mediaApproval, undefined, "never replace an immutable ledger");
      writes += 1;
      current = { ...current, recordVersion: current.recordVersion + 1, mediaApproval: approval };
      return structuredClone(current);
    },
    now: () => "2026-09-10T20:10:00.000Z",
  };
  return {
    dependencies, inspected,
    get current() { return current; },
    get writes() { return writes; },
    get inspections() { return inspections; },
    onInspect(callback: () => void) { inspectHook = callback; },
    onWrite(callback: () => void) { beforeWrite = callback; },
  };
}

async function main() {
  const valid = requestFor(fixture());
  const contextArticle = fixture().article;
  assert.equal(hasApprovedCuratedMediaContext(contextArticle), true);
  for (const altered of [
    { ...contextArticle, slug: "other-story" },
    ...[
      { src: "/news/other-story/cover.jpg" },
      { alt: "Prestige One completed this tower" },
      { credit: "Prestige One" },
      { sourceUrl: "https://attacker.example/cover.jpg" },
      { rightsStatus: "unapproved" },
      { width: 3840 }, { height: 2160 }, { approval: "withheld" },
    ].map((change) => ({ ...contextArticle, heroImage: { ...contextArticle.heroImage, ...change } })),
    null, { approved: true }, { ...contextArticle, heroImage: null },
  ]) {
    assert.equal(hasApprovedCuratedMediaContext(altered), false);
  }
  const pureModule = readFileSync(new URL("../lib/news-review/curated-media-context.ts", import.meta.url), "utf8");
  assert.doesNotMatch(pureModule, /^import\s/mu, "photo context helper must stay dependency-free");
  assert.deepEqual(parseCuratedMediaReuseRequest(valid), valid);
  for (const extra of ["sourceUrl", "rightsStatus", "credit", "repoPath", "contentSha256", "reuseReceipt", "reviewer"]) {
    assert.throws(() => parseCuratedMediaReuseRequest({ ...valid, [extra]: "attacker-controlled" }),
      (error: unknown) => error instanceof CuratedMediaReuseError && error.status === 400);
  }
  for (const input of [null, [], {}, { ...valid, expectedRevision: 0 },
    { ...valid, expectedRecordVersion: 1.5 }, { ...valid, expectedContentHash: "bad" }]) {
    assert.throws(() => parseCuratedMediaReuseRequest(input), CuratedMediaReuseError);
  }
  assert.throws(() => parseCuratedMediaReuseRequest({ ...valid, candidateKey: "unapproved" }),
    (error: unknown) => error instanceof CuratedMediaReuseError && error.status === 403);

  const store = memoryStore();
  const approved = await reuseApprovedCuratedMedia(binding.draftId, valid, store.dependencies);
  assert.equal(store.writes, 1);
  assert.equal(approved.recordVersion, 2);
  assert.equal(approved.mediaApproval?.reviewer, "owner-approved-stock-reuse");
  assert.equal(approved.mediaApproval?.approvedAt, "2026-09-10T20:10:00.000Z");
  assert.deepEqual(approved.mediaApproval?.reuseReceipt, binding.reuseReceipt);
  assert.equal(approved.mediaApproval?.rightsStatus, "licensed");
  assert.doesNotThrow(() => assertRequiredCuratedMediaApproval(approved));
  const { hash, ...record } = approved.mediaApproval!;
  assert.equal(hash, mediaApprovalHash(record));

  const retried = await reuseApprovedCuratedMedia(binding.draftId, requestFor(approved), store.dependencies);
  assert.equal(retried.mediaApproval?.hash, approved.mediaApproval?.hash);
  assert.equal(store.writes, 1);
  assert.equal(store.inspections, 2, "even an exact retry reinspects publication-branch bytes");
  await assert.rejects(reuseApprovedCuratedMedia(binding.draftId, valid, store.dependencies), /Draft changed/);
  await assert.rejects(reuseApprovedCuratedMedia("arbitrary-draft", valid, store.dependencies), /no owner-approved/);

  for (const change of [
    { repoPath: "public/news/other/cover.jpg" }, { contentSha256: "f".repeat(64) },
    { mime: "image/png" as const }, { width: 3840 }, { height: 2160 },
  ]) {
    const altered = memoryStore(approved);
    Object.assign(altered.inspected, change);
    await assert.rejects(reuseApprovedCuratedMedia(binding.draftId, requestFor(approved), altered.dependencies), /image bytes/);
    assert.equal(altered.writes, 0);
  }

  const staleCases = [
    { ...valid, expectedRevision: 2 }, { ...valid, expectedRecordVersion: 2 },
    { ...valid, expectedContentHash: "f".repeat(64) },
  ];
  for (const stale of staleCases) {
    const target = memoryStore();
    await assert.rejects(reuseApprovedCuratedMedia(binding.draftId, stale, target.dependencies), /Draft changed/);
    assert.equal(target.inspections, 0);
    assert.equal(target.writes, 0);
  }
  const concurrent = memoryStore();
  concurrent.onWrite(() => { concurrent.current.recordVersion += 1; });
  await assert.rejects(reuseApprovedCuratedMedia(binding.draftId, valid, concurrent.dependencies), /CAS conflict/);
  assert.equal(concurrent.writes, 0);
  const concurrentRetry = memoryStore(approved);
  concurrentRetry.onInspect(() => { concurrentRetry.current.recordVersion += 1; });
  await assert.rejects(reuseApprovedCuratedMedia(binding.draftId, requestFor(approved), concurrentRetry.dependencies), /Draft changed/);

  const badContext = fixture();
  badContext.article.heroImage.alt = "A completed Prestige One development";
  badContext.contentHash = draftContentHash(badContext.article, badContext.provenance);
  const contextStore = memoryStore(badContext);
  await assert.rejects(reuseApprovedCuratedMedia(binding.draftId, requestFor(badContext), contextStore.dependencies), /exact curated article/);
  assert.equal(contextStore.inspections, 0);

  const alteredLedger = structuredClone(approved);
  alteredLedger.mediaApproval!.credit = "Unrecorded photographer";
  const { hash: ignoredHash, ...changedRecord } = alteredLedger.mediaApproval!;
  void ignoredHash;
  alteredLedger.mediaApproval!.hash = mediaApprovalHash(changedRecord);
  assert.throws(() => assertRequiredCuratedMediaApproval(alteredLedger), /changed or stale/);
  assert.throws(() => assertRequiredCuratedMediaApproval(fixture()), /requires its approved/);
  const absent = memoryStore();
  await assert.rejects(reuseApprovedCuratedMedia(binding.draftId, valid, {
    ...absent.dependencies, getDraft: async () => null,
  }), /Draft not found/);
  await assert.rejects(reuseApprovedCuratedMedia(binding.draftId, valid, {
    ...absent.dependencies, inspectEditorialMedia: async () => { throw new Error("missing cover"); },
  }), /missing cover/);
  assert.equal(absent.writes, 0);

  let stageCalls = 0;
  await ensureCuratedMediaApproval(binding.candidateKey, fixture(), async (pathname, body) => {
    stageCalls += 1;
    assert.equal(pathname, `/api/news/draft/${binding.draftId}/reuse-curated-media`);
    assert.deepEqual(body, valid);
    return { response: { ok: true, status: 200 }, payload: {
      ok: true, mediaApproval: approved.mediaApproval,
      revision: approved.revision, recordVersion: approved.recordVersion, contentHash: approved.contentHash,
    } };
  });
  assert.equal(stageCalls, 1);
  for (const result of [
    { response: { ok: false, status: 503 }, payload: {} },
    { response: { ok: true, status: 200 }, payload: { ok: true } },
    { response: { ok: true, status: 200 }, payload: {
      ok: true, mediaApproval: alteredLedger.mediaApproval,
      revision: 1, recordVersion: 2, contentHash: approved.contentHash,
    } },
  ]) {
    let outputsEmitted = false;
    await assert.rejects((async () => {
      await ensureCuratedMediaApproval(binding.candidateKey, fixture(), async () => result);
      outputsEmitted = true;
    })());
    assert.equal(outputsEmitted, false);
  }

  // Auth and malformed route requests must finish before any storage/network access.
  const oldSecret = process.env.POST_PUBLISH_SECRET;
  const oldSession = process.env.INTERNAL_SESSION_SECRET;
  const originalFetch = globalThis.fetch;
  process.env.POST_PUBLISH_SECRET = "curated-test-secret-".repeat(4);
  process.env.INTERNAL_SESSION_SECRET = "curated-session-secret-".repeat(4);
  globalThis.fetch = async () => { throw new Error("Test attempted external access"); };
  try {
    const { POST } = await import("../app/api/news/draft/[id]/reuse-curated-media/route");
    const url = `https://news.investwithraj.com/api/news/draft/${binding.draftId}/reuse-curated-media`;
    async function call(body: unknown, headers: Record<string, string>, suffix = "", id: string = binding.draftId) {
      return POST(new NextRequest(`${url}${suffix}`, {
        method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body),
      }), { params: Promise.resolve({ id }) });
    }
    const pipelineHeaders = { "x-post-publish-secret": process.env.POST_PUBLISH_SECRET };
    assert.equal((await call(valid, {})).status, 401);
    assert.equal((await call(valid, { "x-post-publish-secret": "wrong" })).status, 401);
    assert.equal((await call(valid, { ...pipelineHeaders, origin: "null" })).status, 403);
    assert.equal((await call(valid, { ...pipelineHeaders, origin: "https://attacker.example" })).status, 403);
    assert.equal((await call(valid, pipelineHeaders, "?asset=other")).status, 403);
    assert.equal((await call({ ...valid, sourceUrl: "https://attacker.example/image.jpg" }, pipelineHeaders)).status, 400);
    assert.equal((await call({ ...valid, candidateKey: "unapproved" }, pipelineHeaders)).status, 403);
    assert.equal((await call(valid, pipelineHeaders, "", "other-draft")).status, 403);
    const session = await createReviewSession();
    assert.ok(session);
    const browser = await call(valid, {
      cookie: `iwr_review_session=${session}`, origin: "https://news.investwithraj.com", "sec-fetch-site": "same-origin",
    });
    assert.equal(browser.status, 403, "ordinary media approval remains the human-session route");
    assert.equal(browser.headers.get("cache-control"), "no-store, max-age=0");
  } finally {
    globalThis.fetch = originalFetch;
    if (oldSecret === undefined) delete process.env.POST_PUBLISH_SECRET;
    else process.env.POST_PUBLISH_SECRET = oldSecret;
    if (oldSession === undefined) delete process.env.INTERNAL_SESSION_SECRET;
    else process.env.INTERNAL_SESSION_SECRET = oldSession;
  }

  const stage = readFileSync(new URL("./stage-curated-candidate.ts", import.meta.url), "utf8");
  assert.match(stage, /await ensureCuratedMediaApproval\(candidate\.key, identical, post\);\s*emitActionOutput/u);
  assert.match(stage, /await ensureCuratedMediaApproval\(candidate\.key, staged, post\);\s*emitActionOutput/u);
  const humanRoute = readFileSync(new URL("../app/api/news/draft/[id]/media-approval/route.ts", import.meta.url), "utf8");
  assert.match(humanRoute, /auth\.credential !== "review-session"/u);
  console.log("Curated media reuse passed: exact owner-approved binary/context, strict request/auth, CAS, immutable retry with reinspection, changed-byte rejection and fail-closed staging.");
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
