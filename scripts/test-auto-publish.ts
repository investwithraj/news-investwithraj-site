import assert from "node:assert/strict";

import { runAutoApprove } from "../lib/news-review/auto-approve.js";
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
} as NewsDraft;
draft.article.publishedAt = "2026-08-12T10:00:00.000Z";

const originalFetch = globalThis.fetch;
const calls: string[] = [];
globalThis.fetch = async (input) => {
  const url = String(input);
  calls.push(url);
  if (url.endsWith("/api/news/draft")) {
    return Response.json({ drafts: [olderDraft, draft] });
  }
  if (url.endsWith(`/api/news/draft/${draft.id}/publish`)) {
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
    const result = await runAutoApprove({
      site: "https://news.example.test",
      secret: "s".repeat(32),
      publish: true,
      publishLimit: 1,
      deploymentAttempts: 0,
      log: () => undefined,
    });
    assert.equal(result.approved, 2);
    assert.equal(result.published, 1);
    assert.equal(result.failed, 0);
    assert.equal(result.held, 0);
    assert.equal(result.deferred, 1);
    assert.equal(calls.length, 2);
    assert.match(calls[1], /\/publish$/);
    assert.ok(calls[1].includes(draft.id), "newest passing draft must publish first");
    console.log(
      "Auto-publish regression passed: evidence-ready draft selected and one bounded publish requested.",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
