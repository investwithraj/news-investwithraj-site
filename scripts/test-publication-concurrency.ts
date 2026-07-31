import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

async function main() {
  const originalDirectory = process.cwd();
  const testDirectory = await fs.mkdtemp(
    path.join(os.tmpdir(), "iwr-publication-"),
  );

  try {
    process.chdir(testDirectory);
    const storage = await import("../lib/news-review/storage");
    const contentHash = "a".repeat(64);
    const commitSha = "b".repeat(40);
    const draftId = "order98-publication";
    const slug = "order-98-publication-regression";
    const now = new Date().toISOString();
    const draft = {
      id: draftId,
      createdAt: now,
      updatedAt: now,
      status: "review",
      article: {
        slug,
        title: "Order 98 publication regression",
        subtitle: "An isolated concurrency fixture.",
        publishedAt: now,
        modifiedAt: now,
        displayDate: "31 Jul 2026",
        author: "raj-tomar",
        tier: "news",
        category: "market-pulse",
        market: ["Dubai"],
        tldr: ["Fixture", "Fixture", "Fixture"],
        body: "Isolated publication storage fixture.",
        faq: [],
        citations: [],
        heroImage: {
          src: `/news/${slug}/cover.webp`,
          alt: "Fixture",
          credit: "Fixture",
        },
        cta: { href: "/", label: "Fixture" },
        distribution: {},
      },
      validator: {
        ok: true,
        failures: [],
        metrics: {
          wordCount: 650,
          headlineLength: 36,
          citationCount: 2,
          citationsFromWhitelist: 2,
          p1HasNumber: true,
        },
      },
      provenance: {
        clusterId: "order98",
        topic: "Order 98",
        score: 100,
        scoreBreakdown: {
          uhnwRelevance: 25,
          sourceTier: 25,
          freshness: 25,
          rajAngle: 25,
        },
        sources: [],
      },
      verifiedSources: [],
      revision: 1,
      recordVersion: 1,
      contentHash,
      evidenceApproval: {
        hash: "evidence-ledger",
        revision: 1,
        contentHash,
        sourceUrls: [],
        evidenceHashes: [],
        reviewer: "raj-review-session",
        approvedAt: now,
      },
      mediaApproval: {
        hash: "media-ledger",
        revision: 1,
        contentHash,
        slug,
        repoPath: `public/news/${slug}/cover.webp`,
        contentSha256: "c".repeat(64),
        mime: "image/webp",
        width: 3840,
        height: 2160,
        sourceUrl: "https://example.com/fixture",
        rightsStatus: "Isolated test fixture only",
        credit: "Fixture",
        reviewer: "raj-review-session",
        approvedAt: now,
      },
    };
    const runsDirectory = path.join(testDirectory, "pipeline-runs");
    await fs.mkdir(runsDirectory, { recursive: true });
    await fs.writeFile(
      path.join(runsDirectory, "news-drafts.json"),
      JSON.stringify([draft]),
      "utf8",
    );

    const expected = {
      revision: 1,
      recordVersion: 1,
      contentHash,
      mediaApprovalHash: "media-ledger",
      evidenceApprovalHash: "evidence-ledger",
    };
    const claims = await Promise.allSettled([
      storage.claimDraftPublication(draftId, expected),
      storage.claimDraftPublication(draftId, expected),
    ]);
    const acquired = claims
      .filter(
        (result): result is PromiseFulfilledResult<NonNullable<Awaited<ReturnType<
          typeof storage.claimDraftPublication
        >>>> => result.status === "fulfilled" && result.value !== null,
      )
      .map((result) => result.value)
      .filter((result) => result.acquired);
    assert.equal(acquired.length, 1, "exactly one publication claim must win");
    const claimId = acquired[0].draft.publication?.claimId;
    assert.ok(claimId);

    const committed = await storage.recordDraftPublicationCommit(
      draftId,
      claimId,
      commitSha,
      `https://news.investwithraj.com/news/${slug}`,
    );
    const committedRetry = await storage.recordDraftPublicationCommit(
      draftId,
      claimId,
      commitSha,
      `https://news.investwithraj.com/news/${slug}`,
    );
    assert.equal(committed.publication?.state, "committed");
    assert.equal(committedRetry.publication?.commitSha, commitSha);

    const completions = await Promise.allSettled([
      storage.completeDraftPublication(draftId, claimId),
      storage.completeDraftPublication(draftId, claimId),
    ]);
    assert.equal(
      completions.filter((result) => result.status === "fulfilled").length,
      1,
      "only one archive/removal transaction must complete",
    );
    assert.equal(await storage.getStoredDraft(draftId), null);
    const receipt = await storage.getPublicationReceipt(draftId);
    const commitReceipt =
      await storage.getPublicationReceiptByCommitSha(commitSha);
    assert.equal(receipt?.commitSha, commitSha);
    assert.equal(commitReceipt?.draftId, draftId);

    console.log(
      "Publication regression passed: single claim, idempotent commit, single completion, receipt and archive retention.",
    );
  } finally {
    process.chdir(originalDirectory);
    await fs.rm(testDirectory, { recursive: true, force: true });
  }
}

void main();
