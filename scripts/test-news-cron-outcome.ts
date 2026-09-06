import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NextRequest } from "next/server";

import {
  GET as getDraftCronStatus,
  POST as postDraftCron,
} from "../app/api/cron/draft/route.js";
import {
  buildNewsCronRunReport,
  emitNewsCronRunReport,
  observeNewestPublication,
  type NewsCronRunInput,
  type PublicationPassTelemetry,
} from "./lib/news-cron-outcome.js";

const SHA = "a".repeat(40);
const publication: PublicationPassTelemetry = {
  total: 3,
  eligible: 3,
  approved: 3,
  published: 1,
  failed: 0,
  held: 0,
  deferred: 2,
  publicationShas: [SHA],
  publishedSlugs: ["2026-08-24-published-story"],
  deploymentVerified: 1,
  pendingVerification: 0,
  verificationSkipped: 0,
  failureMessages: [],
};

function input(
  overrides: Partial<NewsCronRunInput> = {},
): NewsCronRunInput {
  return {
    startedAt: "2026-08-24T06:00:00.000Z",
    finishedAt: "2026-08-24T06:02:00.000Z",
    draftingEnabled: true,
    candidates: 2,
    attempts: 1,
    staged: 1,
    draftHeld: 0,
    technicalFailures: 0,
    failureMessages: [],
    publication,
    observation: {
      feedState: "fresh",
      newestPublishedAt: "2026-08-24T05:00:00.000Z",
      ageHours: 1,
      observedAt: "2026-08-24T06:00:00.000Z",
    },
    ...overrides,
  };
}

async function main(): Promise<void> {
  const previousPostSecret = process.env.POST_PUBLISH_SECRET;
  const previousCronSecret = process.env.CRON_SECRET;
  const previousNodeEnv = process.env.NODE_ENV;
  const previousCronEnabled = process.env.ENABLE_NEWS_DRAFT_CRON;
  process.env.POST_PUBLISH_SECRET = "s".repeat(32);
  process.env.CRON_SECRET = "c".repeat(32);
  try {
    const deniedGet = await getDraftCronStatus(
      new NextRequest("https://news.example.test/api/cron/draft"),
    );
    assert.equal(
      deniedGet.status,
      401,
      "A scheduled GET without CRON_SECRET must fail instead of reporting green",
    );

    const denied = await postDraftCron(
      new NextRequest("https://news.example.test/api/cron/draft", {
        method: "POST",
      }),
    );
    assert.equal(denied.status, 401, "Cron POST must reject an unauthenticated mutation");

    const urlCredential = await postDraftCron(
      new NextRequest("https://news.example.test/api/cron/draft?secret=leak", {
        method: "POST",
      }),
    );
    assert.equal(urlCredential.status, 400, "Cron POST must reject URL credentials");

    const wrongGetCredential = await getDraftCronStatus(
      new NextRequest("https://news.example.test/api/cron/draft", {
        headers: { "x-post-publish-secret": "s".repeat(32) },
      }),
    );
    assert.equal(
      wrongGetCredential.status,
      403,
      "Scheduled GET must require CRON_SECRET rather than the publication secret",
    );

    Reflect.set(process.env, "NODE_ENV", "production");
    delete process.env.ENABLE_NEWS_DRAFT_CRON;
    const authenticatedCron = await getDraftCronStatus(
      new NextRequest("https://news.example.test/api/cron/draft", {
        headers: { authorization: `Bearer ${"c".repeat(32)}` },
      }),
    );
    assert.equal(
      authenticatedCron.status,
      503,
      "A valid Vercel Cron bearer must reach the feature gate",
    );
  } finally {
    if (previousPostSecret === undefined) {
      delete process.env.POST_PUBLISH_SECRET;
    } else {
      process.env.POST_PUBLISH_SECRET = previousPostSecret;
    }
    if (previousCronSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = previousCronSecret;
    if (previousNodeEnv === undefined) Reflect.deleteProperty(process.env, "NODE_ENV");
    else Reflect.set(process.env, "NODE_ENV", previousNodeEnv);
    if (previousCronEnabled === undefined) delete process.env.ENABLE_NEWS_DRAFT_CRON;
    else process.env.ENABLE_NEWS_DRAFT_CRON = previousCronEnabled;
  }

  const observed = await observeNewestPublication({
    site: "https://news.example.test/",
    now: new Date("2026-08-24T06:00:00.000Z"),
    fetcher: async (url, init) => {
      assert.equal(url, "https://news.example.test/api/front");
      assert.equal(init.cache, "no-store");
      return Response.json({
        schemaVersion: "front-v1",
        freshness: {
          state: "fresh",
          newestPublishedAt: "2026-08-24T04:30:00.000Z",
        },
      });
    },
  });
  assert.deepEqual(observed, {
    feedState: "fresh",
    newestPublishedAt: "2026-08-24T04:30:00.000Z",
    ageHours: 1.5,
    observedAt: "2026-08-24T06:00:00.000Z",
  });

  await assert.rejects(
    observeNewestPublication({
      site: "https://news.example.test",
      fetcher: async () =>
        Response.json({
          schemaVersion: "legacy-front",
          freshness: { state: "empty", newestPublishedAt: null },
        }),
    }),
    /did not match front-v1/u,
  );

  const published = buildNewsCronRunReport(input());
  assert.equal(published.primaryOutcome, "published");
  assert.deepEqual(published.outcomes, ["published", "staged", "deferred"]);
  assert.deepEqual(published.publicationShas, [SHA]);

  const held = buildNewsCronRunReport(
    input({
      staged: 0,
      draftHeld: 1,
      publication: { ...publication, published: 0, held: 1, deferred: 0 },
    }),
  );
  assert.equal(held.primaryOutcome, "held");
  assert.deepEqual(held.outcomes, ["held"]);
  assert.equal(held.shouldFail, false, "A fresh feed may tolerate one held-only pass");

  const staleHeld = buildNewsCronRunReport(
    input({
      staged: 0,
      draftHeld: 1,
      draftHoldReasons: ["source publication date missing"],
      publication: {
        ...publication,
        published: 0,
        held: 2,
        deferred: 0,
        holdReasonCounts: { "source-date-or-freshness": 2 },
        heldDetails: [
          { slug: "held-story", reasons: ["source publication date missing"] },
        ],
      },
      observation: {
        feedState: "stale",
        newestPublishedAt: "2026-08-22T06:00:00.000Z",
        ageHours: 48,
        observedAt: "2026-08-24T06:00:00.000Z",
      },
      maxNewestPublicationAgeHours: 36,
    }),
  );
  assert.equal(staleHeld.primaryOutcome, "failed");
  assert.deepEqual(staleHeld.outcomes, ["held", "failed"]);
  assert.equal(staleHeld.shouldFail, true);
  assert.match(staleHeld.operationalFailureReasons[0], /held-only run/u);
  assert.ok(
    staleHeld.actionableReasons.some((reason) =>
      reason.includes("source-date-or-freshness"),
    ),
  );

  const failed = buildNewsCronRunReport(
    input({
      staged: 1,
      technicalFailures: 1,
      failureMessages: ["draft staging returned 503"],
      publication: { ...publication, published: 0, deferred: 0 },
    }),
  );
  assert.equal(failed.primaryOutcome, "failed");
  assert.deepEqual(failed.outcomes, ["staged", "failed"]);

  const noEligible = buildNewsCronRunReport(
    input({
      candidates: 0,
      attempts: 0,
      staged: 0,
      publication: {
        ...publication,
        eligible: 0,
        approved: 0,
        published: 0,
        deferred: 0,
        publicationShas: [],
        publishedSlugs: [],
        deploymentVerified: 0,
      },
    }),
  );
  assert.equal(noEligible.primaryOutcome, "no-eligible");
  assert.deepEqual(noEligible.outcomes, ["no-eligible"]);

  const tempRoot = await mkdtemp(join(tmpdir(), "iwr-news-cron-outcome-"));
  const outputPath = join(tempRoot, "output.txt");
  const summaryPath = join(tempRoot, "summary.md");
  try {
    await emitNewsCronRunReport(published, {
      ...process.env,
      GITHUB_OUTPUT: outputPath,
      GITHUB_STEP_SUMMARY: summaryPath,
      GITHUB_ACTIONS: "false",
    });
    const output = await readFile(outputPath, "utf8");
    const summary = await readFile(summaryPath, "utf8");
    assert.match(output, /^outcome=published$/mu);
    assert.match(output, new RegExp(`^publication_sha=${SHA}$`, "mu"));
    assert.match(output, /^newest_publication_age_hours=1$/mu);
    assert.match(output, /^should_fail=0$/mu);
    assert.match(summary, /Daily news pipeline receipt/u);
    assert.match(summary, new RegExp(SHA, "u"));
    assert.match(summary, /1 hours/u);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }

  console.log(
    "News cron outcome regression passed: published, staged, held, deferred, failed and no-eligible receipts remain distinct.",
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
