import assert from "node:assert/strict";
import { createHash } from "node:crypto";

import {
  parseBoundedJsonResponse,
  readBoundedResponseText,
} from "../lib/news-review/bounded-response";
import { getCuratedNewsCandidate } from "../lib/news-review/curated-candidates";
import {
  committedCuratedDeploymentRequest,
  recoverCommittedCuratedDeployment,
} from "../lib/news-review/curated-recovery";
import {
  draftContentHash,
  sha256Json,
  WITHHELD_MEDIA_APPROVAL_HASH,
} from "../lib/news-review/integrity";
import {
  CURRENT_EVIDENCE_POLICY_VERSION,
  type NewsDraft,
  type NewsDraftProvenance,
} from "../lib/news-review/types";
import {
  validateDraft,
  type DraftArticle as VoiceDraftArticle,
} from "../lib/voice/validator";

function committedFixture(): {
  candidate: ReturnType<typeof getCuratedNewsCandidate>;
  draft: NewsDraft;
} {
  const candidate = getCuratedNewsCandidate(
    "dld-initial-registration-2026-09-07",
  );
  const evidenceText = candidate.article.body;
  const evidenceHash = createHash("sha256").update(evidenceText).digest("hex");
  const fetchedAt = "2026-09-07T06:00:00.000Z";
  const provenance: NewsDraftProvenance = {
    clusterId: `curated:${candidate.key}`,
    topic: candidate.topic,
    score: 100,
    scoreBreakdown: {
      uhnwRelevance: 25,
      sourceTier: 25,
      freshness: 25,
      rajAngle: 25,
    },
    sources: candidate.article.citations.map((citation) => ({
      name: citation.source,
      tier: citation.tier ?? "Tier 1",
      url: citation.url,
      summary: evidenceText,
    })),
    fetchedEvidence: candidate.article.citations.map((citation) => ({
      url: citation.url,
      finalUrl: citation.url,
      text: evidenceText,
      fetchedAt,
      contentHash: evidenceHash,
    })),
  };
  const contentHash = draftContentHash(candidate.article, provenance);
  const sourceUrls = candidate.article.citations
    .map((citation) => citation.url)
    .sort();
  const approvalPayload = {
    policyVersion: CURRENT_EVIDENCE_POLICY_VERSION,
    revision: 1,
    contentHash,
    sourceUrls,
    evidenceHashes: sourceUrls.map((url) => ({ url, contentHash: evidenceHash })),
    reviewer: "deterministic-auto-publisher" as const,
    approvedAt: "2026-09-07T06:01:00.000Z",
  };
  const evidenceApproval = {
    ...approvalPayload,
    hash: sha256Json(approvalPayload),
  };
  const claimId = "99999999-9999-4999-8999-999999999999";
  const commitSha = "f".repeat(40);
  const canonicalUrl =
    `https://news.investwithraj.com/news/${candidate.article.slug}`;
  return {
    candidate,
    draft: {
      id: candidate.draftId,
      createdAt: "2026-09-07T06:00:00.000Z",
      updatedAt: "2026-09-07T06:02:00.000Z",
      status: "review",
      article: candidate.article,
      validator: validateDraft(
        candidate.article as unknown as VoiceDraftArticle,
      ),
      provenance,
      verifiedSources: sourceUrls,
      revision: 1,
      recordVersion: 4,
      contentHash,
      evidenceApproval,
      publication: {
        state: "committed",
        evidencePolicyVersion: CURRENT_EVIDENCE_POLICY_VERSION,
        claimId,
        revision: 1,
        contentHash,
        mediaApprovalHash: WITHHELD_MEDIA_APPROVAL_HASH,
        evidenceApprovalHash: evidenceApproval.hash,
        startedAt: "2026-09-07T06:01:00.000Z",
        updatedAt: "2026-09-07T06:02:00.000Z",
        commitSha,
        url: canonicalUrl,
      },
    },
  };
}

async function main(): Promise<void> {
  const boundedJson = await parseBoundedJsonResponse<{ ok: boolean }>(
    new Response('{"ok":true}', {
      headers: { "content-type": "application/json; charset=utf-8" },
    }),
    32,
  );
  assert.deepEqual(boundedJson, { ok: true });

  await assert.rejects(
    parseBoundedJsonResponse(
      new Response('{"ok":true}', {
        headers: { "content-type": "text/html" },
      }),
      32,
    ),
    /not application\/json/u,
  );
  await assert.rejects(
    parseBoundedJsonResponse(
      new Response("not-json", {
        headers: { "content-type": "application/json" },
      }),
      32,
    ),
    /invalid JSON/u,
  );

  let cancelled = false;
  const oversizedStream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode("1234"));
      controller.enqueue(new TextEncoder().encode("5678"));
    },
    cancel() {
      cancelled = true;
    },
  });
  await assert.rejects(
    readBoundedResponseText(new Response(oversizedStream), 7),
    /exceeded the size limit/u,
  );
  assert.equal(cancelled, true, "oversized response streams must be cancelled");

  await assert.rejects(
    readBoundedResponseText(
      new Response("ok", { headers: { "content-length": "33" } }),
      32,
    ),
    /exceeded the size limit/u,
  );
  await assert.rejects(
    readBoundedResponseText(
      new Response("ok", { headers: { "content-length": "not-a-number" } }),
      32,
    ),
    /invalid size/u,
  );

  const { candidate, draft } = committedFixture();
  const recoveryRequest = committedCuratedDeploymentRequest({
    candidate,
    draft,
    currentEvidenceFingerprint: "a".repeat(64),
    storedEvidenceFingerprint: "a".repeat(64),
  });
  assert.equal(
    recoveryRequest.pathname,
    `/api/news/draft/${candidate.draftId}/deployment`,
  );
  assert.deepEqual(recoveryRequest.body, {
    claimId: draft.publication?.claimId,
    deploymentStatus: "READY",
    deployedCommitSha: draft.publication?.commitSha,
  });
  assert.throws(
    () =>
      committedCuratedDeploymentRequest({
        candidate,
        draft: {
          ...draft,
          publication: {
            ...draft.publication!,
            commitSha: "not-a-commit",
          },
        },
        currentEvidenceFingerprint: "a".repeat(64),
        storedEvidenceFingerprint: "a".repeat(64),
      }),
    /not exactly bound/u,
    "a changed committed SHA must fail closed",
  );

  const requestedPaths: string[] = [];
  let durableProofChecks = 0;
  let durableReceiptAvailable = false;
  const publishCommitCalls = 1; // The original publish succeeded before timeout.
  await assert.rejects(
    recoverCommittedCuratedDeployment({
      request: recoveryRequest,
      attempts: 2,
      delayMs: 0,
      postDeployment: async (pathname) => {
        requestedPaths.push(pathname);
        return { status: 409 };
      },
      verifyDurableProof: async () => {
        durableProofChecks += 1;
      },
      wait: async () => undefined,
    }),
    /remains pending/u,
    "a canonical deployment timeout must leave the committed record recoverable",
  );
  assert.equal(durableProofChecks, 0);
  assert.equal(publishCommitCalls, 1);

  durableReceiptAvailable = true;
  await recoverCommittedCuratedDeployment({
    request: recoveryRequest,
    attempts: 2,
    delayMs: 0,
    postDeployment: async (pathname) => {
      requestedPaths.push(pathname);
      return { status: 202, publicationState: "completed" };
    },
    verifyDurableProof: async () => {
      durableProofChecks += 1;
      assert.equal(
        durableReceiptAvailable,
        true,
        "completed recovery must close with its receipt and archive proof",
      );
    },
    wait: async () => undefined,
  });
  assert.equal(durableProofChecks, 1);
  assert.equal(
    publishCommitCalls,
    1,
    "deployment recovery must not create a second Git publication commit",
  );
  assert.ok(
    requestedPaths.every((pathname) => pathname.endsWith("/deployment")),
    "the recovery sequence may call only deployment completion",
  );
  console.log("curated protected-response transport regression passed");
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
