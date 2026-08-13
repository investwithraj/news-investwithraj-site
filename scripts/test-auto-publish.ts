import assert from "node:assert/strict";

import {
  assessDraft,
  runAutoApprove,
} from "../lib/news-review/auto-approve.js";
import type { NewsDraft } from "../lib/news-review/types.js";

const sourceA = "https://example.com/source-a";
const sourceB = "https://example.org/source-b";
const evidence =
  "The verified transaction value was AED 10 million according to the official record.";

const draft = {
  id: "auto-publish-regression",
  article: {
    slug: "2026-08-12-auto-publish-regression",
    title: "Auto-publish regression",
    body: "The verified transaction value was AED 10 million.",
    citations: [
      { source: "Source A", url: sourceA },
      { source: "Source B", url: sourceB },
    ],
  },
  validator: {
    ok: true,
    failures: [],
    metrics: {
      citationCount: 2,
      citationsFromWhitelist: 2,
    },
  },
  provenance: {
    fetchedEvidence: [
      { url: sourceA, text: evidence },
      { url: sourceB, text: evidence },
    ],
  },
} as unknown as NewsDraft;

const olderDraft = {
  ...draft,
  id: "auto-publish-regression-older",
  article: {
    ...draft.article,
    slug: "2026-08-11-auto-publish-regression-older",
    publishedAt: "2026-08-11T10:00:00.000Z",
  },
  provenance: {
    ...draft.provenance,
    score: 80,
  },
} as NewsDraft;
const staleDraft = {
  ...draft,
  id: "auto-publish-regression-stale",
  article: {
    ...draft.article,
    slug: "2026-07-01-auto-publish-regression-stale",
    publishedAt: "2026-07-01T10:00:00.000Z",
  },
  provenance: {
    ...draft.provenance,
    score: 100,
  },
} as NewsDraft;
draft.article.publishedAt = "2026-08-12T10:00:00.000Z";
draft.provenance.score = 50;

const originalFetch = globalThis.fetch;
const calls: string[] = [];
globalThis.fetch = async (input) => {
  const url = String(input);
  calls.push(url);
  if (url.endsWith("/api/news/draft")) {
    return Response.json({ drafts: [staleDraft, olderDraft, draft] });
  }
  if (/\/api\/news\/draft\/[^/]+\/publish$/.test(url)) {
    return Response.json(
      {
        claimId: "00000000-0000-4000-8000-000000000000",
        commitSha: "a".repeat(40),
      },
      { status: 202 },
    );
  }
  throw new Error(`Unexpected request: ${url}`);
};

async function main() {
  try {
    const oneSourceDraft = (input: {
      id: string;
      url: string;
      source: string;
      category: NewsDraft["article"]["category"];
      body: string;
    }) => ({
      ...draft,
      id: input.id,
      article: {
        ...draft.article,
        category: input.category,
        body: input.body,
        citations: [{ source: input.source, url: input.url }],
      },
      validator: {
        ...draft.validator,
        metrics: { citationCount: 1, citationsFromWhitelist: 1 },
      },
      provenance: {
        ...draft.provenance,
        fetchedEvidence: [{ url: input.url, text: evidence }],
      },
    }) as NewsDraft;

    const reutersDraft = oneSourceDraft({
      id: "single-reuters",
      url: "https://www.reuters.com/world/middle-east/example-report",
      source: "Reuters",
      category: "market-pulse",
      body: "Reuters reported that the verified transaction value was AED 10 million.",
    });
    const reutersAssessment = assessDraft(reutersDraft);
    assert.equal(reutersAssessment.verdict, "auto-approve");
    assert.equal(reutersAssessment.evidenceLane, "fast-news");
    assert.equal(reutersAssessment.requiredPublisherCount, 1);

    const officialDraft = oneSourceDraft({
      id: "single-government",
      url: "https://dubailand.gov.ae/en/news/example-release",
      source: "Dubai Land Department",
      category: "regulatory",
      body: "Dubai Land Department confirmed a verified transaction value of AED 10 million.",
    });
    assert.equal(assessDraft(officialDraft).evidenceLane, "official-update");
    assert.equal(assessDraft(officialDraft).verdict, "auto-approve");

    const developerDraft = oneSourceDraft({
      id: "single-developer",
      url: "https://www.aldar.com/en/news-and-media/example-launch",
      source: "Aldar Properties",
      category: "launch",
      body: "Aldar announced that the verified transaction value was AED 10 million.",
    });
    assert.equal(
      assessDraft(developerDraft).evidenceLane,
      "developer-announcement",
    );
    assert.equal(assessDraft(developerDraft).verdict, "auto-approve");

    const recommendationDraft = oneSourceDraft({
      id: "single-source-recommendation",
      url: "https://www.reuters.com/world/middle-east/example-analysis",
      source: "Reuters",
      category: "market-pulse",
      body: "We recommend investors buy after the verified transaction value reached AED 10 million.",
    });
    assert.equal(
      assessDraft(recommendationDraft).evidenceLane,
      "corroborated-analysis",
    );
    assert.equal(
      assessDraft(recommendationDraft).verdict,
      "manual",
      "investment recommendations must still require two publishers",
    );

    const samePublisherDraft = {
      ...draft,
      id: "auto-publish-same-publisher",
      article: {
        ...draft.article,
        citations: [
          { source: "Source A", url: sourceA },
          { source: "Source A", url: "https://example.com/source-b" },
        ],
      },
      provenance: {
        ...draft.provenance,
        fetchedEvidence: [
          { url: sourceA, text: evidence },
          { url: "https://example.com/source-b", text: evidence },
        ],
      },
    } as NewsDraft;
    assert.equal(
      assessDraft(samePublisherDraft).verdict,
      "manual",
      "two URLs from one publisher must not satisfy independent corroboration",
    );

    const typographyVariantDraft = {
      ...draft,
      article: {
        ...draft.article,
        body:
          "The contracts total AED3.5 billion, cover 8,000 homes and represent 30 per cent of the programme.",
      },
      provenance: {
        ...draft.provenance,
        fetchedEvidence: [
          {
            url: sourceA,
            text:
              "The official release states that contracts total AED 3.5 billion and cover 8000 homes across the verified development programme.",
          },
          {
            url: sourceB,
            text:
              "Independent reporting says the awards represent 30% of the programme and confirms the same construction mandate in its full report.",
          },
        ],
      },
    } as NewsDraft;
    assert.equal(
      assessDraft(typographyVariantDraft).verdict,
      "auto-approve",
      "equivalent currency, comma and percentage typography must verify",
    );

    const result = await runAutoApprove({
      site: "https://news.example.test",
      secret: "s".repeat(32),
      publish: true,
      publishLimit: 1,
      deploymentAttempts: 0,
      log: () => undefined,
    });
    assert.equal(result.approved, 3);
    assert.equal(result.published, 1);
    assert.equal(result.failed, 0);
    assert.equal(result.held, 0);
    assert.equal(result.deferred, 2);
    assert.equal(calls.length, 2);
    assert.match(calls[1], /\/publish$/);
    assert.ok(calls[1].includes(draft.id), "newest passing draft must publish first");

    calls.length = 0;
    const backlogResult = await runAutoApprove({
      site: "https://news.example.test",
      secret: "s".repeat(32),
      publish: true,
      publishLimit: 1,
      publishOrder: "backlog",
      now: new Date("2026-08-12T12:00:00.000Z"),
      deploymentAttempts: 0,
      log: () => undefined,
    });
    assert.equal(backlogResult.published, 1);
    assert.equal(backlogResult.eligible, 1);
    assert.equal(calls.length, 2);
    assert.ok(
      calls[1].includes(olderDraft.id),
      "backlog lane must publish the strongest still-timely draft first",
    );
    console.log(
      "Auto-publish regression passed: four risk lanes plus newest and timely-backlog selection are enforced.",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
