import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import manifestFixture from "../ops/news-corrections/aldar-offplan-mortgage-2026-09-06.json";

async function main() {
  const originalDirectory = process.cwd();
  const testDirectory = await fs.mkdtemp(
    path.join(os.tmpdir(), "iwr-news-correction-"),
  );
  try {
    process.chdir(testDirectory);
    const autoApprove = await import("../lib/news-review/auto-approve");
    const integrity = await import("../lib/news-review/integrity");
    const correction = await import("../lib/news-review/correction");
    const { CURRENT_EVIDENCE_POLICY_VERSION } = await import(
      "../lib/news-review/types"
    );
    const correctedShape = integrity.validateDraftArticleShape(
      structuredClone(manifestFixture.article),
    );
    assert.equal(
      correctedShape.ok,
      true,
      correctedShape.ok ? undefined : correctedShape.error,
    );
    if (!correctedShape.ok) return;
    const corrected = structuredClone(correctedShape.article);
    const sourceEvidenceTexts = [
      [
        "Buyers who have paid 50 per cent can secure mortgages before the off-plan home is handed over.",
        "The framework allows buyers who have paid 50 per cent of an eligible off-plan unit's value to mortgage the outstanding amount before construction is complete.",
        "Banks can fund remaining instalments during construction and the final payment due at handover.",
        "The 50 per cent payment threshold is aligned with UAE Central Bank regulations, according to Aldar.",
        "The service is free to customers and provides access to mortgage options from more than six conventional and Islamic banks.",
      ].join(" "),
      [
        "A customer who has paid 50 per cent of the purchase price can arrange a mortgage against their off-plan property, with the bank funding the remaining instalments and the final handover payment.",
        "This is in line with UAE Central Bank regulation, which requires customers to have paid 50 per cent of the property price to be eligible for off-plan mortgage financing.",
        "Off-plan financing is available to Aldar customers who have paid 50 per cent or more of the property value at eligible projects.",
      ].join(" "),
    ];
    const correctedClaimTexts = autoApprove
      .articleEvidenceSegments(corrected)
      .map((segment) => segment.text);
    assert.deepEqual(
      autoApprove.findUnsupportedFigures(
        correctedClaimTexts,
        sourceEvidenceTexts,
      ),
      [],
      "the correction must use only numeric tuples present in source-faithful evidence",
    );

    const unsupportedCorrection = structuredClone(corrected);
    unsupportedCorrection.tldr[1] =
      "Eligible buyers who have paid 50 per cent can arrange financing for the outstanding amount before handover.";
    unsupportedCorrection.body = unsupportedCorrection.body.replace(
      "50 per cent payment threshold as a blanket approval",
      "50 per cent threshold as a blanket approval",
    );
    assert.deepEqual(
      autoApprove
        .findUnsupportedFigures(
          autoApprove
            .articleEvidenceSegments(unsupportedCorrection)
            .map((segment) => segment.text),
          sourceEvidenceTexts,
        )
        .sort(),
      ["50 per cent can arrange financing", "50 per cent threshold"].sort(),
      "the prior correction wording must remain held by the numeric evidence gate",
    );

    const originalArticle = structuredClone(corrected);
    delete originalArticle.correction;
    originalArticle.modifiedAt = originalArticle.publishedAt;
    const sourceUrls = originalArticle.citations.map((citation) => citation.url);
    const provenance = {
      clusterId: "correction-test-cluster",
      topic: "Aldar ADCB off-plan mortgage registration",
      score: 95,
      scoreBreakdown: {
        uhnwRelevance: 24,
        sourceTier: 24,
        freshness: 24,
        rajAngle: 23,
      },
      sources: originalArticle.citations.map((citation, index) => ({
        name: citation.source,
        tier: citation.tier ?? "national-press",
        url: citation.url,
        summary: sourceEvidenceTexts[index],
        publishedAt: originalArticle.publishedAt,
      })),
      fetchedEvidence: originalArticle.citations.map((citation, index) => {
        const text = sourceEvidenceTexts[index];
        return {
          url: citation.url,
          finalUrl: citation.url,
          text,
          fetchedAt: originalArticle.publishedAt,
          contentHash: createHash("sha256").update(text).digest("hex"),
          sourcePublishedAt: originalArticle.publishedAt,
          sourceDateSource: "meta" as const,
          freshnessCheckedAt: originalArticle.publishedAt,
          freshnessMaxAgeHours: 168,
        };
      }),
    };
    const originalHash = integrity.draftContentHash(
      originalArticle,
      provenance,
    );
    const approval = integrity.evidenceApprovalFor(
      1,
      originalHash,
      sourceUrls,
      provenance,
      originalArticle,
      originalArticle.publishedAt,
      "deterministic-auto-publisher",
    );
    assert.ok(approval, "fixture evidence approval must pass");
    const originalId = "published-correction-fixture";
    const commitSha = "b".repeat(40);
    const archived = {
      id: originalId,
      createdAt: originalArticle.publishedAt,
      updatedAt: originalArticle.publishedAt,
      status: "review" as const,
      article: originalArticle,
      validator: { ok: true, failures: [], metrics: {} },
      provenance,
      verifiedSources: sourceUrls,
      revision: 1,
      recordVersion: 4,
      contentHash: originalHash,
      evidenceApproval: approval,
      publication: {
        state: "completed" as const,
        evidencePolicyVersion: CURRENT_EVIDENCE_POLICY_VERSION,
        claimId: "11111111-1111-4111-8111-111111111111",
        revision: 1,
        contentHash: originalHash,
        mediaApprovalHash: integrity.WITHHELD_MEDIA_APPROVAL_HASH,
        evidenceApprovalHash: approval.hash,
        startedAt: originalArticle.publishedAt,
        updatedAt: originalArticle.publishedAt,
        commitSha,
        url: `https://news.investwithraj.com/news/${originalArticle.slug}`,
      },
    };
    const archiveDirectory = path.join(
      testDirectory,
      "pipeline-runs",
      "news-publication-archive",
    );
    await fs.mkdir(archiveDirectory, { recursive: true });
    await fs.writeFile(
      path.join(archiveDirectory, `${originalId}.json`),
      JSON.stringify(archived),
      "utf8",
    );

    const correctionManifest = {
      originalDraftId: originalId,
      expectedOriginalCommitSha: commitSha,
      expectedOriginalContentHash: originalHash,
      article: corrected,
    };
    const first = await correction.stagePublishedCorrection(
      correctionManifest,
      "2026-09-06T20:11:00.000Z",
    );
    const replay = await correction.stagePublishedCorrection(
      correctionManifest,
      "2026-09-06T20:12:00.000Z",
    );
    assert.equal(first.state, "active");
    assert.equal(replay.state, "active");
    assert.equal(first.draft.id, replay.draft.id);
    assert.equal(first.draft.contentHash, replay.draft.contentHash);
    assert.equal(first.draft.correctionOf?.contentHash, originalHash);
    assert.notEqual(first.draft.contentHash, originalHash);
    assert.ok(first.draft.evidenceApproval);
    await correction.assertPublishedCorrectionLineage(first.draft);
    await assert.rejects(
      correction.assertPublishedCorrectionLineage({
        ...first.draft,
        correctionOf: undefined,
      }),
      /must appear together/,
    );
    await assert.rejects(
      correction.assertPublishedCorrectionLineage({
        ...first.draft,
        article: { ...first.draft.article, correction: undefined },
      }),
      /must appear together/,
    );
    await assert.rejects(
      correction.assertPublishedCorrectionLineage({
        ...first.draft,
        correctionOf: {
          ...first.draft.correctionOf!,
          commitSha: "c".repeat(40),
        },
      }),
      /does not match a completed publication/,
    );

    await assert.rejects(
      correction.stagePublishedCorrection(
        {
          ...correctionManifest,
          article: {
            ...corrected,
            citations: corrected.citations.slice().reverse(),
          },
        },
        "2026-09-06T20:13:00.000Z",
      ),
      /citations must exactly match/,
    );

    const originalArchivePath = path.join(
      archiveDirectory,
      `${originalId}.json`,
    );
    await fs.writeFile(
      originalArchivePath,
      JSON.stringify({
        ...archived,
        publication: {
          ...archived.publication,
          mediaApprovalHash: "8".repeat(64),
        },
      }),
      "utf8",
    );
    await assert.rejects(
      correction.stagePublishedCorrection(
        correctionManifest,
        "2026-09-06T20:13:00.000Z",
      ),
      /does not prove withheld media/,
    );
    await fs.writeFile(
      originalArchivePath,
      JSON.stringify({
        ...archived,
        mediaApproval: { hash: "unexpected-approved-media" },
      }),
      "utf8",
    );
    await assert.rejects(
      correction.stagePublishedCorrection(
        correctionManifest,
        "2026-09-06T20:13:30.000Z",
      ),
      /separate signed media review/,
    );
    await fs.writeFile(
      originalArchivePath,
      JSON.stringify(archived),
      "utf8",
    );

    await fs.writeFile(
      path.join(archiveDirectory, `${first.draft.id}.json`),
      JSON.stringify({
        ...first.draft,
        contentHash: "9".repeat(64),
        publication: {
          state: "completed",
          contentHash: "9".repeat(64),
        },
      }),
      "utf8",
    );
    await assert.rejects(
      correction.stagePublishedCorrection(
        correctionManifest,
        "2026-09-06T20:14:00.000Z",
      ),
      /archive does not match/,
    );

    console.log(
      "Correction storage regression passed: archived lineage, fresh evidence approval, deterministic replay and citation drift rejection.",
    );
  } finally {
    process.chdir(originalDirectory);
    await fs.rm(testDirectory, { recursive: true, force: true });
  }
}

void main();
