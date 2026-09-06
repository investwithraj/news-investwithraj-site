import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import { CURRENT_EVIDENCE_POLICY_VERSION } from "../lib/news-review/types.js";

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
    const sourcePublishedAt = now;
    const sourceText =
      "The verified transaction value was AED 10 million. Independent reporting provides enough directly fetched context for the isolated publication concurrency fixture.";
    const sourceUrls = [
      "https://www.reuters.com/world/middle-east/order-98-fixture",
      "https://www.thenationalnews.com/business/property/order-98-fixture/",
    ];
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
        citations: [
          {
            source: "Reuters",
            url: sourceUrls[0],
            accessedAt: now,
            tier: "national-press",
          },
          {
            source: "The National — Business",
            url: sourceUrls[1],
            accessedAt: now,
            tier: "national-press",
          },
        ],
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
        sources: sourceUrls.map((url, index) => ({
          name: index === 0 ? "Reuters" : "The National — Business",
          tier: "national-press",
          url,
          publishedAt: sourcePublishedAt,
          summary: "Independent approved publisher fixture.",
        })),
        fetchedEvidence: sourceUrls.map((url, index) => ({
          url,
          finalUrl: url,
          text: sourceText,
          fetchedAt: now,
          contentHash: String(index + 1).repeat(64),
          sourcePublishedAt,
          sourceDateSource: "meta",
          freshnessCheckedAt: now,
          freshnessMaxAgeHours: 168,
        })),
      },
      verifiedSources: sourceUrls,
      revision: 1,
      recordVersion: 1,
      contentHash,
      evidenceApproval: {
        policyVersion: CURRENT_EVIDENCE_POLICY_VERSION,
        hash: "evidence-ledger",
        revision: 1,
        contentHash,
        sourceUrls,
        evidenceHashes: sourceUrls.map((url, index) => ({
          url,
          contentHash: String(index + 1).repeat(64),
        })),
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
    const legacyEvidenceApproval = {
      ...draft.evidenceApproval,
    } as Partial<typeof draft.evidenceApproval>;
    delete legacyEvidenceApproval.policyVersion;
    const legacyDraft = {
      ...draft,
      id: `${draftId}-legacy-policy`,
      evidenceApproval: legacyEvidenceApproval,
    };
    const previousPolicyDraft = {
      ...draft,
      id: `${draftId}-previous-policy`,
      evidenceApproval: {
        ...draft.evidenceApproval,
        policyVersion: 2 as typeof CURRENT_EVIDENCE_POLICY_VERSION,
      },
    };
    const runsDirectory = path.join(testDirectory, "pipeline-runs");
    await fs.mkdir(runsDirectory, { recursive: true });
    await fs.writeFile(
      path.join(runsDirectory, "news-drafts.json"),
      JSON.stringify([draft, legacyDraft, previousPolicyDraft]),
      "utf8",
    );

    const expected = {
      revision: 1,
      recordVersion: 1,
      contentHash,
      mediaApprovalHash: "media-ledger",
      evidenceApprovalHash: "evidence-ledger",
    };
    await assert.rejects(
      storage.claimDraftPublication(legacyDraft.id, expected),
      /approval ledger changed/,
      "a serialized pre-version approval must not create a publication claim",
    );
    await assert.rejects(
      storage.claimDraftPublication(previousPolicyDraft.id, expected),
      /approval ledger changed/,
      "a serialized v2 approval must not create a v3 publication claim",
    );
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
    assert.equal(
      acquired[0].draft.publication?.evidencePolicyVersion,
      CURRENT_EVIDENCE_POLICY_VERSION,
    );

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
    assert.equal(receipt?.claimId, claimId);
    assert.equal(
      receipt?.evidencePolicyVersion,
      CURRENT_EVIDENCE_POLICY_VERSION,
    );
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
