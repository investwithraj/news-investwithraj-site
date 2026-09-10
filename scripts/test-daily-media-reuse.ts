import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";

import { getCuratedNewsCandidate } from "../lib/news-review/curated-candidates";
import { expectedDailyMediaFields, selectDailyNewsMedia } from "../lib/news-review/daily-media-catalog";
import {
  assertRequiredDailyMediaApproval,
  DailyMediaReuseError,
  ensureDailyMediaApproval,
  parseDailyMediaReuseRequest,
  reuseApprovedDailyMedia,
  type DailyMediaReuseDependencies,
  type DailyMediaReuseRequest,
} from "../lib/news-review/daily-media";
import { draftContentHash, mediaApprovalHash } from "../lib/news-review/integrity";
import { createReviewSession } from "../lib/news-review/session";
import type { NewsDraft, NewsDraftProvenance } from "../lib/news-review/types";
import { validateDraft, type DraftArticle as VoiceArticle } from "../lib/voice/validator";

function fixture(): NewsDraft {
  const candidate = getCuratedNewsCandidate("prestige-one-investment-2026-09-10");
  const article = structuredClone(candidate.article);
  article.slug = "2026-09-11-dubai-daily-media-test";
  const selected = selectDailyNewsMedia(article);
  const expected = expectedDailyMediaFields(article);
  assert.ok(selected && expected);
  article.heroImage = {
    src: `/${expected.repoPath.replace(/^public\//u, "")}`,
    alt: selected.alt,
    credit: selected.credit,
    sourceUrl: selected.sourceUrl,
    rightsStatus: selected.rightsStatus,
    width: selected.width,
    height: selected.height,
    approval: "approved-editorial",
  };
  const provenance: NewsDraftProvenance = {
    clusterId: "daily-media-test",
    topic: article.title,
    score: 100,
    scoreBreakdown: { uhnwRelevance: 25, sourceTier: 25, freshness: 25, rajAngle: 25 },
    sources: article.citations.map((citation) => ({
      name: citation.source,
      tier: citation.tier ?? "government",
      url: citation.url,
      summary: article.body,
    })),
  };
  return {
    id: "daily-media-test-draft",
    createdAt: "2026-09-11T02:00:00.000Z",
    updatedAt: "2026-09-11T02:00:00.000Z",
    status: "review",
    article,
    provenance,
    validator: validateDraft(article as unknown as VoiceArticle),
    revision: 1,
    recordVersion: 1,
    contentHash: draftContentHash(article, provenance),
  };
}

function requestFor(draft: NewsDraft): DailyMediaReuseRequest {
  return {
    expectedRevision: draft.revision,
    expectedRecordVersion: draft.recordVersion,
    expectedContentHash: draft.contentHash,
  };
}

async function main() {
  const originalDirectory = process.cwd();
  const testDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "iwr-daily-media-"));
  const envKeys = ["KV_REST_API_URL", "KV_REST_API_TOKEN", "NODE_ENV", "POST_PUBLISH_SECRET", "INTERNAL_SESSION_SECRET"] as const;
  const originalEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
  const originalFetch = globalThis.fetch;
  let writes = 0;
  let attachments = 0;
  let inspections = 0;
  let beforeInspect: () => Promise<void> = async () => {};
  let beforeLedger: () => Promise<void> = async () => {};
  try {
    delete process.env.KV_REST_API_URL;
    delete process.env.KV_REST_API_TOKEN;
    Object.assign(process.env, { NODE_ENV: "test" });
    process.chdir(testDirectory);
    globalThis.fetch = async () => { throw new Error("No external access in the media service test"); };
    const storage = await import("../lib/news-review/storage");
    const file = path.join(testDirectory, "pipeline-runs", "news-drafts.json");
    async function seed(draft = fixture()) {
      await fs.mkdir(path.dirname(file), { recursive: true });
      await fs.writeFile(file, JSON.stringify([draft]), "utf8");
      writes = attachments = inspections = 0;
      beforeInspect = beforeLedger = async () => {};
      return draft;
    }
    const initial = fixture();
    const expected = expectedDailyMediaFields(initial.article)!;
    const inspected = {
      repoPath: expected.repoPath,
      contentSha256: expected.contentSha256,
      mime: expected.mime,
      width: expected.width,
      height: expected.height,
    };
    const dependencies: DailyMediaReuseDependencies = {
      getDraft: storage.getDraft,
      ensureApprovedDailyMediaCover: async (article) => {
        attachments += 1;
        assert.equal(article.slug, initial.article.slug);
        return { ...inspected };
      },
      inspectEditorialMedia: async (slug) => {
        inspections += 1;
        assert.equal(slug, initial.article.slug);
        await beforeInspect();
        return { ...inspected };
      },
      setMediaApproval: async (id, approval, cas) => {
        await beforeLedger();
        const updated = await storage.setMediaApproval(id, approval, cas);
        writes += 1;
        return updated;
      },
      now: () => "2026-09-11T02:05:00.000Z",
    };
    const input = requestFor(initial);
    assert.deepEqual(parseDailyMediaReuseRequest(input), input);
    for (const extra of ["id", "assetId", "sourceUrl", "rightsStatus", "credit", "repoPath", "contentSha256", "reuseReceipt", "reviewer"]) {
      assert.throws(() => parseDailyMediaReuseRequest({ ...input, [extra]: "arbitrary" }), DailyMediaReuseError);
    }
    for (const invalid of [null, [], {}, { ...input, expectedRevision: 0 },
      { ...input, expectedRecordVersion: 1.5 }, { ...input, expectedContentHash: "z".repeat(64) }]) {
      assert.throws(() => parseDailyMediaReuseRequest(invalid), DailyMediaReuseError);
    }

    await seed();
    const approved = await reuseApprovedDailyMedia(initial.id, input, dependencies);
    assert.equal(approved.recordVersion, 2);
    assert.equal(writes, 1);
    assert.equal(attachments, 1);
    assert.equal(inspections, 1);
    assert.equal(approved.mediaApproval?.reviewer, "owner-approved-stock-reuse");
    assert.deepEqual(approved.mediaApproval?.reuseReceipt, expected.reuseReceipt);
    assert.equal(approved.mediaApproval?.repoPath, `public/news/${initial.article.slug}/cover.jpg`);
    assert.doesNotThrow(() => assertRequiredDailyMediaApproval(approved));
    const { hash, ...record } = approved.mediaApproval!;
    assert.equal(hash, mediaApprovalHash(record));

    const retry = await reuseApprovedDailyMedia(initial.id, requestFor(approved), dependencies);
    assert.equal(retry.mediaApproval?.hash, hash);
    assert.equal(writes, 1);
    assert.equal(attachments, 1, "an existing ledger never triggers an asset write");
    assert.equal(inspections, 2, "a retry must inspect current branch bytes");
    await assert.rejects(reuseApprovedDailyMedia(initial.id, input, dependencies), /Draft changed/u);
    const alteredApproval = { ...approved.mediaApproval!, credit: "Changed credit" };
    const { hash: unused, ...alteredRecord } = alteredApproval;
    void unused;
    alteredApproval.hash = mediaApprovalHash(alteredRecord);
    await assert.rejects(storage.setMediaApproval(initial.id, alteredApproval, {
      revision: approved.revision, recordVersion: approved.recordVersion, contentHash: approved.contentHash,
    }), /immutable/u);

    const human = structuredClone(approved);
    human.mediaApproval!.reviewer = "raj-review-session";
    delete human.mediaApproval!.reuseReceipt;
    const { hash: priorHash, ...humanRecord } = human.mediaApproval!;
    void priorHash;
    human.mediaApproval!.hash = mediaApprovalHash(humanRecord);
    await seed(human);
    const retained = await reuseApprovedDailyMedia(human.id, requestFor(human), dependencies);
    assert.equal(retained.mediaApproval?.hash, human.mediaApproval!.hash);
    assert.equal(attachments, 0);
    assert.equal(writes, 0);

    for (const alteration of [
      { repoPath: "public/news/other/cover.jpg" }, { contentSha256: "f".repeat(64) },
      { mime: "image/png" as const }, { width: 3840 }, { height: 2160 },
    ]) {
      await seed(approved);
      await assert.rejects(reuseApprovedDailyMedia(initial.id, requestFor(approved), {
        ...dependencies,
        inspectEditorialMedia: async () => ({ ...inspected, ...alteration }),
      }), /image bytes/u);
      assert.equal(writes, 0);
      assert.equal(attachments, 0);
    }

    for (const change of [
      { expectedRevision: 2 }, { expectedRecordVersion: 2 }, { expectedContentHash: "a".repeat(64) },
    ]) {
      await seed();
      await assert.rejects(reuseApprovedDailyMedia(initial.id, { ...input, ...change }, dependencies), /Draft changed/u);
      assert.equal(attachments, 0);
    }
    for (const invalidId of ["../draft", "draft/x", "", "x".repeat(129)]) {
      await assert.rejects(reuseApprovedDailyMedia(invalidId, input, dependencies), /Invalid draft ID/u);
    }
    await assert.rejects(reuseApprovedDailyMedia("nonexistent", input, dependencies), /not found/u);
    const wrongContext = fixture();
    wrongContext.article.heroImage.alt = "A completed Prestige One building";
    wrongContext.contentHash = draftContentHash(wrongContext.article, wrongContext.provenance);
    await seed(wrongContext);
    await assert.rejects(reuseApprovedDailyMedia(wrongContext.id, requestFor(wrongContext), dependencies), /media context/u);
    assert.equal(attachments, 0);
    const unknown = fixture();
    unknown.article.market = ["Abu Dhabi"];
    unknown.article.format = "long-form" as typeof unknown.article.format;
    unknown.contentHash = draftContentHash(unknown.article, unknown.provenance);
    await seed(unknown);
    await assert.rejects(reuseApprovedDailyMedia(unknown.id, requestFor(unknown), dependencies), /media context/u);
    assert.equal(attachments, 0);

    // Use the actual file-store CAS, not a simulated immutable ledger.
    await seed();
    beforeInspect = async () => {
      await fs.writeFile(file, JSON.stringify([{ ...initial, recordVersion: 2 }]), "utf8");
    };
    await assert.rejects(reuseApprovedDailyMedia(initial.id, input, dependencies), /Draft changed/u);
    assert.equal(attachments, 1, "a stale draft can leave an approved orphan asset only");
    assert.equal(writes, 0);
    assert.equal((await storage.getDraft(initial.id))?.mediaApproval, undefined);
    await seed();
    beforeLedger = async () => {
      await fs.writeFile(file, JSON.stringify([{ ...initial, recordVersion: 2 }]), "utf8");
    };
    await assert.rejects(reuseApprovedDailyMedia(initial.id, input, dependencies), storage.DraftConflictError);
    assert.equal(writes, 0);
    await seed();
    const concurrent = await Promise.allSettled([
      reuseApprovedDailyMedia(initial.id, input, dependencies),
      reuseApprovedDailyMedia(initial.id, input, dependencies),
    ]);
    assert.equal(concurrent.filter((result) => result.status === "fulfilled").length, 1);
    assert.equal(writes, 1);
    assert.equal((await storage.getDraft(initial.id))?.recordVersion, 2);

    let calls = 0;
    await ensureDailyMediaApproval(initial, async (pathname, body) => {
      calls += 1;
      assert.equal(pathname, `/api/news/draft/${initial.id}/reuse-daily-media`);
      assert.deepEqual(body, input);
      return { response: { ok: true, status: 200 }, payload: {
        ok: true, revision: approved.revision, recordVersion: approved.recordVersion,
        contentHash: approved.contentHash, mediaApproval: approved.mediaApproval,
      } };
    });
    assert.equal(calls, 1);
    for (const payload of [{ ok: true }, {
      ok: true, revision: 1, recordVersion: 99, contentHash: initial.contentHash, mediaApproval: approved.mediaApproval,
    }, {
      ok: true, revision: 1, recordVersion: 1, contentHash: initial.contentHash, mediaApproval: approved.mediaApproval,
    }]) {
      await assert.rejects(ensureDailyMediaApproval(initial, async () => ({
        response: { ok: true, status: 200 }, payload,
      })), /failed closed/u);
    }

    process.env.POST_PUBLISH_SECRET = "daily-media-test-secret-".repeat(4);
    process.env.INTERNAL_SESSION_SECRET = "daily-media-session-secret-".repeat(4);
    const { POST } = await import("../app/api/news/draft/[id]/reuse-daily-media/route");
    const url = `https://news.investwithraj.com/api/news/draft/${initial.id}/reuse-daily-media`;
    async function call(body: unknown, headers: Record<string, string>, suffix = "", id = initial.id) {
      return POST(new NextRequest(`${url}${suffix}`, {
        method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body),
      }), { params: Promise.resolve({ id }) });
    }
    const auth = { "x-post-publish-secret": process.env.POST_PUBLISH_SECRET };
    assert.equal((await call(input, {})).status, 401);
    assert.equal((await call(input, { "x-post-publish-secret": "wrong" })).status, 401);
    assert.equal((await call(input, { ...auth, origin: "null" })).status, 403);
    assert.equal((await call(input, { ...auth, origin: "https://attacker.example" })).status, 403);
    assert.equal((await call(input, auth, "?asset=other")).status, 403);
    assert.equal((await call(input, auth, "?secret=not-accepted")).status, 400);
    assert.equal((await call({ ...input, sourceUrl: "https://attacker.example" }, auth)).status, 400);
    assert.equal((await call({ ...input, credit: "a".repeat(3000) }, auth)).status, 413);
    assert.equal((await call(input, auth, "", "../draft")).status, 400);
    const session = await createReviewSession();
    assert.ok(session);
    const browser = await call(input, {
      cookie: `iwr_review_session=${session}`, origin: "https://news.investwithraj.com", "sec-fetch-site": "same-origin",
    });
    assert.equal(browser.status, 403);
    assert.equal(browser.headers.get("cache-control"), "no-store, max-age=0");
    console.log("Daily media reuse passed: strict server auth/input, selected context, real immutable storage CAS, race safety, no overwrite, reinspection and stage validation.");
  } finally {
    process.chdir(originalDirectory);
    globalThis.fetch = originalFetch;
    for (const key of envKeys) {
      if (originalEnv[key] === undefined) delete process.env[key];
      else Object.assign(process.env, { [key]: originalEnv[key] });
    }
    // The random directory is created above and contains test fixtures only.
    if (path.dirname(testDirectory) !== os.tmpdir() || !path.basename(testDirectory).startsWith("iwr-daily-media-")) {
      throw new Error("Refusing to remove an unexpected test directory.");
    }
    await fs.rm(testDirectory, { recursive: true, force: true });
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
