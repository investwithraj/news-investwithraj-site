import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { CURRENT_EVIDENCE_POLICY_VERSION } from "../lib/news-review/types";
import { getNewsArticleLifecycle } from "../lib/news-lifecycle";
import { INDEXABLE_NEWS_ARTICLES } from "../lib/public-content";

type Remediation = "content-repair" | "second-source-required";
type MatrixDisposition = "KEEP" | "IMPROVE";

type ManifestRecord = Readonly<{
  slug: string;
  remediation: Remediation;
  interimIntent: "noindex-hold";
  matrixDisposition: MatrixDisposition;
  keepPilot: boolean;
}>;

type Manifest = Readonly<{
  schemaVersion: string;
  evidencePolicyVersion: number;
  status: string;
  implementationBoundary: Readonly<{
    runtimeBehaviorChanged: boolean;
    runtimeSelectorsChanged: boolean;
    lifecycleCountsChanged: boolean;
    contentRecordsChanged: boolean;
    manualHashBackfillAllowed: boolean;
    unresolvedIndexationIntent: string;
  }>;
  summary: Readonly<{
    unresolved: number;
    contentRepair: number;
    secondSourceRequired: number;
    noindexHold: number;
    keepPilot: number;
  }>;
  safestKeepPilot: string;
  records: ManifestRecord[];
}>;

const ROOT = process.cwd();
const MANIFEST_PATH = "docs/migration/newsroom-legacy-evidence-remediation.json";

function source(path: string): string {
  return readFileSync(resolve(ROOT, path), "utf8");
}

function sorted(values: readonly string[]): string[] {
  return [...values].sort();
}

function distinctCitationDomains(urls: readonly string[]): number {
  return new Set(
    urls.map((url) => new URL(url).hostname.replace(/^www\./u, "")),
  ).size;
}

function main(): void {
  const originalCutover = process.env.NEWSROOM_LIFECYCLE_CUTOVER;
  const manifest = JSON.parse(source(MANIFEST_PATH)) as Manifest;

  assert.equal(
    manifest.schemaVersion,
    "newsroom-legacy-evidence-remediation-v1",
  );
  assert.equal(manifest.evidencePolicyVersion, CURRENT_EVIDENCE_POLICY_VERSION);
  assert.equal(manifest.status, "manifest-only-unresolved");
  assert.deepEqual(manifest.implementationBoundary, {
    runtimeBehaviorChanged: false,
    runtimeSelectorsChanged: false,
    lifecycleCountsChanged: false,
    contentRecordsChanged: false,
    manualHashBackfillAllowed: false,
    unresolvedIndexationIntent: "noindex-hold",
  });

  const records = manifest.records;
  const recordSlugs = records.map((record) => record.slug);
  assert.equal(new Set(recordSlugs).size, records.length, "Duplicate manifest slug.");
  assert.deepEqual(recordSlugs, sorted(recordSlugs), "Manifest records must be sorted.");

  const unresolvedArticles = INDEXABLE_NEWS_ARTICLES.filter(
    (article) => !article.publicationContentHash,
  );
  const unresolvedSlugs = sorted(unresolvedArticles.map((article) => article.slug));
  assert.deepEqual(recordSlugs, unresolvedSlugs);

  const articleBySlug = new Map(
    unresolvedArticles.map((article) => [article.slug, article] as const),
  );
  const contentRepair = records.filter(
    (record) => record.remediation === "content-repair",
  );
  const secondSourceRequired = records.filter(
    (record) => record.remediation === "second-source-required",
  );
  const keepPilots = records.filter((record) => record.keepPilot);

  assert.equal(records.length, 24);
  assert.equal(contentRepair.length, 17);
  assert.equal(secondSourceRequired.length, 7);
  assert.equal(keepPilots.length, 1);
  assert.ok(records.every((record) => record.interimIntent === "noindex-hold"));
  assert.deepEqual(manifest.summary, {
    unresolved: records.length,
    contentRepair: contentRepair.length,
    secondSourceRequired: secondSourceRequired.length,
    noindexHold: records.length,
    keepPilot: keepPilots.length,
  });

  for (const record of records) {
    const article = articleBySlug.get(record.slug);
    assert.ok(article, `Missing unresolved article ${record.slug}.`);
    assert.equal(article.publicationContentHash, undefined);

    const citationUrls = article.citations.map((citation) => citation.url);
    const citationDomains = distinctCitationDomains(citationUrls);
    if (record.remediation === "second-source-required") {
      assert.equal(article.citations.length, 1, `${record.slug} is not one-source.`);
      assert.equal(citationDomains, 1, `${record.slug} has more than one domain.`);
    } else {
      assert.ok(article.citations.length >= 2, `${record.slug} lacks two citations.`);
      assert.ok(citationDomains >= 2, `${record.slug} lacks two citation domains.`);
    }

    const lifecycle = getNewsArticleLifecycle(record.slug);
    assert.ok(lifecycle, `Missing lifecycle row for ${record.slug}.`);
    assert.equal(lifecycle.disposition, record.matrixDisposition);
  }

  assert.equal(keepPilots[0]?.slug, manifest.safestKeepPilot);
  assert.equal(keepPilots[0]?.remediation, "content-repair");
  assert.equal(keepPilots[0]?.matrixDisposition, "KEEP");
  assert.equal(
    records.filter((record) => record.matrixDisposition === "KEEP").length,
    1,
  );
  assert.equal(
    records.filter((record) => record.matrixDisposition === "IMPROVE").length,
    23,
  );

  for (const runtimePath of [
    "app/sitemap.ts",
    "lib/news-lifecycle.ts",
    "lib/public-content.ts",
  ]) {
    assert.doesNotMatch(
      source(runtimePath),
      /newsroom-legacy-evidence-remediation/iu,
      `${runtimePath} must not consume the manifest in this static-only slice.`,
    );
  }
  assert.equal(originalCutover, process.env.NEWSROOM_LIFECYCLE_CUTOVER);

  console.log(
    `Legacy evidence remediation PASS: ${records.length} unresolved = ${contentRepair.length} content-repair + ${secondSourceRequired.length} second-source-required; ${records.length} carry noindex-hold intent; pilot ${manifest.safestKeepPilot}; runtime selectors unchanged.`,
  );
}

main();
