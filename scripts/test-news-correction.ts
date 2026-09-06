import assert from "node:assert/strict";

import { NextRequest } from "next/server";

import manifest from "../ops/news-corrections/aldar-offplan-mortgage-2026-09-06.json";
import { POST } from "../app/api/news/correction/route";
import { validateDraftArticleShape } from "../lib/news-review/integrity";
import { validateDraft } from "../lib/voice/validator";

async function main() {
  const article = manifest.article as unknown;
  const result = validateDraftArticleShape(article);
  assert.equal(result.ok, true, result.ok ? undefined : result.error);
  if (!result.ok) return;
  assert.equal("status" in result.article, false);
  assert.equal("publicationContentHash" in result.article, false);
  assert.deepEqual(result.article.distribution, {});
  assert.ok(result.article.correction?.summary);
  assert.equal(
    result.article.correction?.correctedAt,
    result.article.modifiedAt,
  );
  assert.equal(validateDraft(result.article).ok, true);

  const mutableEnvironment = process.env as Record<string, string | undefined>;
  const previousSecret = mutableEnvironment.POST_PUBLISH_SECRET;
  mutableEnvironment.POST_PUBLISH_SECRET = "test-correction-secret-that-is-long-enough";
  try {
    const unauthorized = await POST(
      new NextRequest("https://news.investwithraj.com/api/news/correction", {
        method: "POST",
        body: JSON.stringify({ correctionKey: "missing" }),
        headers: { "content-type": "application/json" },
      }),
    );
    assert.equal(unauthorized.status, 401);

    const querySecret = await POST(
      new NextRequest(
        "https://news.investwithraj.com/api/news/correction?secret=forbidden",
        {
          method: "POST",
          body: JSON.stringify({ correctionKey: "missing" }),
          headers: {
            "content-type": "application/json",
            "x-post-publish-secret": mutableEnvironment.POST_PUBLISH_SECRET,
          },
        },
      ),
    );
    assert.equal(querySecret.status, 400);

    const unknown = await POST(
      new NextRequest("https://news.investwithraj.com/api/news/correction", {
        method: "POST",
        body: JSON.stringify({ correctionKey: "missing" }),
        headers: {
          "content-type": "application/json",
          "x-post-publish-secret": mutableEnvironment.POST_PUBLISH_SECRET,
        },
      }),
    );
    assert.equal(unknown.status, 404);
  } finally {
    if (previousSecret === undefined) delete mutableEnvironment.POST_PUBLISH_SECRET;
    else mutableEnvironment.POST_PUBLISH_SECRET = previousSecret;
  }

  console.log(
    "News correction contract passed: exact manifest shape, visible disclosure, social-off state and server-only staging.",
  );
}

void main();
