import assert from "node:assert/strict";

import { serializeArticle } from "../lib/news-review/serialize";
import type {
  DraftArticle,
  PublicationCorrectionOrigin,
} from "../lib/news-review/types";

const slug = "2026-09-06-correction-github-fixture";
const oldHash = "a".repeat(64);
const oldCommit = "b".repeat(40);
const newCommit = "c".repeat(40);
const headCommit = "d".repeat(40);
const treeSha = "e".repeat(40);
const oldBlob = "f".repeat(40);
const newBlob = "1".repeat(40);
const oldText = `export const article = {\n  "publicationContentHash": "${oldHash}"\n};\n`;

const article: DraftArticle = {
  slug,
  title: "Correction GitHub fixture",
  subtitle: "A bounded correction commit fixture.",
  publishedAt: "2026-09-06T10:00:00.000Z",
  modifiedAt: "2026-09-06T11:00:00.000Z",
  correction: {
    correctedAt: "2026-09-06T11:00:00.000Z",
    summary: "The wording was corrected while the cited evidence remained unchanged.",
  },
  displayDate: "06 Sept 2026",
  author: "raj-tomar",
  tier: "news",
  category: "market-pulse",
  market: ["Dubai"],
  tldr: ["One", "Two", "Three"],
  body: "A corrected article body used only by the isolated GitHub client regression test.",
  faq: [],
  citations: [],
  heroImage: {
    src: `/news/${slug}/cover.jpg`,
    alt: "Fixture",
    credit: "Withheld",
  },
  cta: {
    href: "https://investwithraj.com/engage",
    label: "Discuss",
  },
  distribution: {},
};

const correctionOf: PublicationCorrectionOrigin = {
  draftId: "original-draft",
  revision: 1,
  contentHash: oldHash,
  commitSha: oldCommit,
};

function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function baseResponses(options: {
  currentText: string;
  currentBlob: string;
  priorText?: string;
  priorBlob?: string;
  latestCommit?: string;
  putStatus?: number;
}) {
  const expected = serializeArticle({
    ...article,
    publicationContentHash: "2".repeat(64),
    heroImage: {
      ...article.heroImage,
      credit: "Verified editorial image withheld pending UHD rights approval",
      approval: "withheld",
    },
  });
  let putCount = 0;
  const fetcher: typeof fetch = async (input, init) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    if (url.endsWith("/git/ref/heads/main")) {
      return json({ object: { sha: headCommit } });
    }
    if (url.endsWith(`/git/commits/${headCommit}`)) {
      return json({ tree: { sha: treeSha } });
    }
    if (url.includes("/contents/content/news/index.ts?ref=main")) {
      const source = `import { article as fixture } from "./${slug}";\nexport const NEWS_ARTICLES = [fixture];\n`;
      return json({ content: Buffer.from(source).toString("base64"), encoding: "base64" });
    }
    if (url.includes("/contents/lib/article-relations.ts?ref=main")) {
      const source = `export const ARTICLE_RELATION_RECORDS = [\n  { articleSlug: "${slug}", areaSlugs: [], developerSlugs: [] },\n];\n`;
      return json({ content: Buffer.from(source).toString("base64"), encoding: "base64" });
    }
    if (
      url.includes(`/contents/content/news/${slug}.ts?ref=main`) &&
      method === "GET"
    ) {
      return json({
        content: Buffer.from(options.currentText).toString("base64"),
        encoding: "base64",
        sha: options.currentBlob,
      });
    }
    if (
      url.includes(
        `/contents/content/news/${slug}.ts?ref=${oldCommit}`,
      )
    ) {
      return json({
        content: Buffer.from(options.priorText ?? oldText).toString("base64"),
        encoding: "base64",
        sha: options.priorBlob ?? oldBlob,
      });
    }
    if (url.includes(`/commits?sha=main&path=content%2Fnews%2F${slug}.ts`)) {
      return json([{ sha: options.latestCommit ?? newCommit }]);
    }
    if (
      options.latestCommit &&
      url.includes(
        `/contents/content/news/${slug}.ts?ref=${options.latestCommit}`,
      )
    ) {
      return json({
        content: Buffer.from(options.currentText).toString("base64"),
        encoding: "base64",
        sha: options.currentBlob,
      });
    }
    if (
      url.endsWith(`/contents/content/news/${slug}.ts`) &&
      method === "PUT"
    ) {
      putCount += 1;
      const body = JSON.parse(String(init?.body)) as {
        sha?: string;
        content?: string;
        branch?: string;
      };
      assert.equal(body.sha, oldBlob);
      assert.equal(body.branch, "main");
      assert.equal(
        Buffer.from(body.content ?? "", "base64").toString("utf8"),
        expected,
      );
      if (options.putStatus) {
        return json({ message: "sha does not match" }, options.putStatus);
      }
      return json({ commit: { sha: newCommit }, content: { sha: newBlob } });
    }
    throw new Error(`Unexpected GitHub request: ${method} ${url}`);
  };
  return { fetcher, getPutCount: () => putCount, expected };
}

async function main() {
  const mutableEnvironment = process.env as Record<string, string | undefined>;
  mutableEnvironment.GITHUB_TOKEN = "test-github-token";
  const originalFetch = globalThis.fetch;
  const github = await import("../lib/news-review/github");
  try {
    const first = baseResponses({
      currentText: oldText,
      currentBlob: oldBlob,
    });
    globalThis.fetch = first.fetcher;
    const committed = await github.publishArticleCommit(
      slug,
      article,
      null,
      "2".repeat(64),
      correctionOf,
    );
    assert.equal(committed, newCommit);
    assert.equal(first.getPutCount(), 1);

    const drifted = baseResponses({
      currentText: `${oldText}\n// drift`,
      currentBlob: newBlob,
      priorText: oldText,
      priorBlob: oldBlob,
    });
    globalThis.fetch = drifted.fetcher;
    await assert.rejects(
      github.publishArticleCommit(
        slug,
        article,
        null,
        "2".repeat(64),
        correctionOf,
      ),
      /no longer matches/,
    );
    assert.equal(drifted.getPutCount(), 0);

    const raced = baseResponses({
      currentText: oldText,
      currentBlob: oldBlob,
      putStatus: 409,
    });
    globalThis.fetch = raced.fetcher;
    await assert.rejects(
      github.publishArticleCommit(
        slug,
        article,
        null,
        "2".repeat(64),
        correctionOf,
      ),
      /GitHub PUT.*409/,
    );
    assert.equal(raced.getPutCount(), 1);

    const exactRetry = baseResponses({
      currentText: first.expected,
      currentBlob: newBlob,
      latestCommit: newCommit,
    });
    globalThis.fetch = exactRetry.fetcher;
    const recovered = await github.publishArticleCommit(
      slug,
      article,
      null,
      "2".repeat(64),
      correctionOf,
    );
    assert.equal(recovered, newCommit);
    assert.equal(exactRetry.getPutCount(), 0);

    console.log(
      "GitHub correction regression passed: exact-origin update, drift refusal and idempotent commit recovery.",
    );
  } finally {
    globalThis.fetch = originalFetch;
    delete mutableEnvironment.GITHUB_TOKEN;
  }
}

void main();
