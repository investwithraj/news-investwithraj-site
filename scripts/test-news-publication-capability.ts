import assert from "node:assert/strict";
import { NextRequest } from "next/server";

import { GET as publicationCapability } from "../app/api/news/draft/[id]/publish/route.js";
import type { NewsArticle } from "../content/news/types.js";
import { executeDistributionOperation } from "../lib/distribute/operation.js";
import type { DistributionRun } from "../lib/distribute/types.js";
import {
  notifyVerifiedPostPublish,
  postPublishCompletionStatus,
} from "../lib/news-review/post-publish.js";
import { publicationFailureDiagnostic } from "../lib/news-review/publication-diagnostic.js";
import { orchestratePostPublish } from "../lib/post-publish/orchestrator.js";
import type { IndexNowResult } from "../lib/search/indexnow.js";
import { executeIndexNowOperation } from "../lib/search/indexnow-operation.js";

const SECRET = "s".repeat(32);
const CLAIM_ID = "00000000-0000-4000-8000-000000000000";
const COMMIT_SHA = "a".repeat(40);
const CANONICAL =
  "https://news.investwithraj.com/news/2026-09-06-capability-test";

const acceptedIndexNowResult: IndexNowResult = {
  ok: true,
  statusCode: 200,
  message: "accepted",
  submittedUrls: 1,
  receipts: [],
};

const article = {
  slug: "2026-09-06-capability-test",
} as NewsArticle;

const deliveredRun: DistributionRun = {
  articleSlug: article.slug,
  startedAt: "2026-09-06T08:00:00.000Z",
  finishedAt: "2026-09-06T08:00:01.000Z",
  results: [],
  successCount: 1,
  failureCount: 0,
  skippedCount: 0,
  scheduledCount: 0,
  deliveredCount: 1,
};

async function capabilityCheck(): Promise<void> {
  const previousSecret = process.env.POST_PUBLISH_SECRET;
  process.env.POST_PUBLISH_SECRET = SECRET;
  try {
    const denied = await publicationCapability(
      new NextRequest(
        "https://news.investwithraj.com/api/news/draft/missing-capability-test/publish",
      ),
      { params: Promise.resolve({ id: "missing-capability-test" }) },
    );
    assert.equal(denied.status, 401);

    const response = await publicationCapability(
      new NextRequest(
        "https://news.investwithraj.com/api/news/draft/missing-capability-test/publish",
        { headers: { "x-post-publish-secret": SECRET } },
      ),
      { params: Promise.resolve({ id: "missing-capability-test" }) },
    );
    assert.equal(response.status, 200);
    const payload = (await response.json()) as {
      ok: boolean;
      capability: Record<string, unknown>;
      blockers: string[];
    };
    assert.equal(payload.ok, false);
    assert.equal(payload.capability.draftFound, false);
    assert.ok(payload.blockers.includes("draft-not-found"));
    assert.deepEqual(
      Object.keys(payload.capability).sort(),
      [
        "automatedEvidenceReady",
        "draftFound",
        "durableStorageBackend",
        "evidenceLane",
        "githubPublicationConfigured",
        "publicationState",
        "requiredPublisherCount",
      ].sort(),
    );
    assert.ok(!JSON.stringify(payload).includes(SECRET));
  } finally {
    if (previousSecret === undefined) delete process.env.POST_PUBLISH_SECRET;
    else process.env.POST_PUBLISH_SECRET = previousSecret;
  }
}

async function durableOperationReceipts(): Promise<void> {
  const indexNow = await executeIndexNowOperation(
    {
      idempotencyKey: "indexnow-receipt-write-failure",
      urls: [CANONICAL],
      callerIdentifier: "test",
    },
    {
      claimIndexNow: async () => ({
        status: "owner",
        token: "owner-token",
        payloadDigest: "payload-digest",
      }),
      markIndexNowDispatched: async () => true,
      submitToIndexNow: async () => acceptedIndexNowResult,
      completeIndexNow: async () => false,
    },
  );
  assert.equal(indexNow.status, "pending");
  if (indexNow.status !== "pending") throw new Error("unreachable");
  assert.equal(indexNow.attempted, true);
  assert.equal(indexNow.duplicate, false);
  assert.equal(indexNow.receiptPersisted, false);
  assert.equal(indexNow.reason, "receipt-not-persisted");
  assert.equal(indexNow.result?.ok, true);

  const distribution = await executeDistributionOperation(
    {
      idempotencyKey: "distribution-receipt-write-failure",
      articles: [article],
      channels: ["telegram"],
    },
    {
      claimDistributionOperation: async () => ({
        status: "owner",
        token: "owner-token",
        payloadDigest: "payload-digest",
      }),
      markDistributionDispatched: async () => true,
      distributeBatch: async () => [deliveredRun],
      completeDistributionOperation: async () => false,
    },
  );
  assert.equal(distribution.status, "pending");
  if (distribution.status !== "pending") throw new Error("unreachable");
  assert.equal(distribution.attempted, true);
  assert.equal(distribution.duplicate, false);
  assert.equal(distribution.receiptPersisted, false);
  assert.equal(distribution.reason, "receipt-not-persisted");
  assert.equal(distribution.result?.ok, true);

  const orchestrated = await orchestratePostPublish(
    {
      idempotencyKey: "post-publish-receipt-write-failure",
      callerIdentifier: "test",
      deploymentId: COMMIT_SHA,
      urls: [CANONICAL],
      articles: [article],
      channels: ["telegram"],
      requestIndexing: true,
      requestDistribution: true,
    },
    {
      indexNowEnabled: () => true,
      channelConfiguration: (channel) => ({
        channel,
        via: "telegram-bot",
        featureEnabled: true,
        configured: true,
        active: true,
        reason: null,
      }),
      executeIndexNowOperation: async () => indexNow,
      executeDistributionOperation: async () => distribution,
    },
  );
  assert.equal(orchestrated.ok, false);
  assert.equal(orchestrated.pending, true);
  assert.equal(orchestrated.indexing.status, "pending");
  assert.equal(orchestrated.indexing.ok, false);
  assert.equal(orchestrated.indexing.receiptPersisted, false);
  assert.equal(orchestrated.distribution.status, "pending");
  assert.equal(orchestrated.distribution.ok, false);
  assert.equal(orchestrated.distribution.receiptPersisted, false);
}

async function postPublishContract(): Promise<void> {
  let calls = 0;
  const completed = await notifyVerifiedPostPublish({
    origin: "https://news.investwithraj.com/",
    secret: SECRET,
    claimId: CLAIM_ID,
    commitSha: COMMIT_SHA,
    canonicalUrl: CANONICAL,
    fetcher: async (url, init) => {
      calls += 1;
      assert.equal(
        url,
        "https://news.investwithraj.com/api/post-publish",
      );
      assert.equal(init.method, "POST");
      const headers = new Headers(init.headers);
      assert.equal(headers.get("x-post-publish-secret"), SECRET);
      assert.equal(headers.get("Idempotency-Key"), `news-${CLAIM_ID}`);
      assert.deepEqual(JSON.parse(String(init.body)), {
        newUrls: [CANONICAL],
        deploymentId: COMMIT_SHA,
        indexNow: true,
        distribute: false,
        confirm: true,
      });
      return Response.json({
        ok: true,
        pending: false,
        indexing: {
          requested: true,
          status: "completed",
          attempted: true,
          ok: true,
          receiptPersisted: true,
        },
        distribution: {
          requested: false,
          status: "not-applicable",
          attempted: false,
          ok: true,
        },
      });
    },
  });
  assert.equal(calls, 1);
  assert.equal(completed.ok, true);
  assert.equal(completed.code, "completed");
  assert.equal(completed.indexing?.status, "completed");
  assert.equal(completed.indexing?.receiptPersisted, true);
  assert.equal(postPublishCompletionStatus(completed), 200);

  const pending = await notifyVerifiedPostPublish({
    origin: "https://news.investwithraj.com",
    secret: SECRET,
    claimId: CLAIM_ID,
    commitSha: COMMIT_SHA,
    canonicalUrl: CANONICAL,
    fetcher: async () =>
      Response.json(
        {
          ok: true,
          pending: true,
          indexing: {
            requested: true,
            status: "pending",
            attempted: false,
            ok: true,
            duplicate: true,
          },
          distribution: {
            requested: true,
            status: "pending",
            attempted: false,
            ok: true,
            duplicate: true,
          },
        },
        { status: 202 },
      ),
  });
  assert.equal(pending.ok, false);
  assert.equal(pending.pending, true);
  assert.equal(pending.code, "pending");
  assert.equal(postPublishCompletionStatus(pending), 202);

  const unpersisted = await notifyVerifiedPostPublish({
    origin: "https://news.investwithraj.com",
    secret: SECRET,
    claimId: CLAIM_ID,
    commitSha: COMMIT_SHA,
    canonicalUrl: CANONICAL,
    fetcher: async () =>
      Response.json({
        ok: true,
        pending: false,
        indexing: {
          requested: true,
          status: "completed",
          attempted: true,
          ok: true,
          receiptPersisted: false,
        },
        distribution: {
          requested: false,
          status: "not-applicable",
          attempted: false,
          ok: true,
        },
      }),
  });
  assert.equal(unpersisted.ok, false);
  assert.equal(unpersisted.pending, true);
  assert.equal(unpersisted.code, "pending");
  assert.equal(unpersisted.indexing?.receiptPersisted, false);
  assert.equal(
    postPublishCompletionStatus(unpersisted),
    202,
    "a live deployment with an unpersisted downstream receipt remains retryable",
  );

  const missingSecret = await notifyVerifiedPostPublish({
    origin: "https://news.investwithraj.com",
    secret: "short",
    claimId: CLAIM_ID,
    commitSha: COMMIT_SHA,
    canonicalUrl: CANONICAL,
    fetcher: async () => {
      throw new Error("must not be called");
    },
  });
  assert.equal(missingSecret.code, "post-publish-secret-missing");
  assert.ok(!JSON.stringify(missingSecret).includes("short"));
}

function diagnosticCheck(): void {
  assert.deepEqual(
    publicationFailureDiagnostic(
      new Error("GitHub returned 401 Bad credentials: token secret-value"),
      "github-commit",
    ),
    {
      code: "github-authentication-failed",
      stage: "github-commit",
      retryable: false,
      operatorAction: "Replace or re-authorise the newsroom GitHub credential.",
    },
  );
  const unknown = publicationFailureDiagnostic(
    new Error("provider leaked secret-value"),
    "receipt-recording",
  );
  assert.equal(unknown.code, "publication-upstream-failure");
  assert.ok(!JSON.stringify(unknown).includes("secret-value"));
}

async function main(): Promise<void> {
  await capabilityCheck();
  await durableOperationReceipts();
  await postPublishContract();
  diagnosticCheck();
  console.log(
    "Publication capability regression passed: protected diagnosis is secret-safe and verified deployments trigger bounded post-publish receipts.",
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
