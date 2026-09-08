import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { NextRequest } from "next/server";

import sitemap from "../app/sitemap";
import nextConfig from "../next.config";
import { proxy } from "../proxy";
import { getIndexablePublicNewsArticles } from "../lib/news-discovery";
import {
  canonicalNewsroomRedirectDestination,
  CURRENT_RELEASE_ALDAR_REDIRECT_DESTINATION,
  CURRENT_RELEASE_ALDAR_REDIRECT_SOURCE,
  CURRENT_RELEASE_NEWSROOM_REDIRECT_SOURCE,
  CURRENT_RELEASE_NEWSROOM_REDIRECT_SOURCES,
  CURRENT_RELEASE_NEWSROOM_REDIRECTS,
  FULL_RELEASE_NEWSROOM_REDIRECTS,
  NEWSROOM_EXACT_REDIRECTS,
  NEWSROOM_HELD_REDIRECTS,
  NEWSROOM_LIFECYCLE_CUTOVER_ENV,
  NEWSROOM_RELEASE_REMOVAL_CANDIDATES,
  PRIMARY_NEWSROOM_LIFECYCLE,
  getNewsroomLifecycle,
  getReleasedNewsroomRedirects,
  isNewsroomLifecycleCutoverEnabled,
  isReleasedNewsroomRemovalPath,
} from "../lib/news-lifecycle";
import {
  EVIDENCE_CERTIFIED_INDEXABLE_NEWS_ARTICLES,
  INDEXABLE_NEWS_ARTICLES,
  NEWSROOM_EVIDENCE_HOLD_PREVIEW_ENV,
  NEWSROOM_EVIDENCE_HOLD_SLUGS,
  PUBLISHED_NEWS_ARTICLES,
  getPublicDiscoveryNewsArticles,
  isNewsroomEvidenceHoldPreviewEnabled,
} from "../lib/public-content";
import { CURRENT_EVIDENCE_POLICY_VERSION } from "../lib/news-review/types";

const ROOT = process.cwd();
const AUTHORITY_PATH = "docs/migration/news-url-disposition.csv";
const CURRENT_EVIDENCE_POLICY_LABEL = new RegExp(
  `evidence policy v${CURRENT_EVIDENCE_POLICY_VERSION}`,
  "iu",
);
const STALE_EVIDENCE_POLICY_LABEL = new RegExp(
  `evidence policy v(?!${CURRENT_EVIDENCE_POLICY_VERSION}\\b)\\d+`,
  "iu",
);

type Redirect = Readonly<{
  source: string;
  destination: string;
  permanent?: boolean;
  statusCode?: number;
}>;

type CsvRow = Readonly<Record<string, string>>;

function source(path: string): string {
  return readFileSync(resolve(ROOT, path), "utf8");
}

function parseCsv(input: string): CsvRow[] {
  const records: string[][] = [];
  let record: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (quoted) {
      if (character === '"' && input[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
      continue;
    }
    if (character === '"') {
      quoted = true;
    } else if (character === ",") {
      record.push(field);
      field = "";
    } else if (character === "\n") {
      record.push(field.replace(/\r$/u, ""));
      records.push(record);
      record = [];
      field = "";
    } else {
      field += character;
    }
  }
  if (field || record.length > 0) {
    record.push(field.replace(/\r$/u, ""));
    records.push(record);
  }

  const [headers, ...rows] = records.filter((row) => row.some(Boolean));
  assert.ok(headers, "The lifecycle authority needs a CSV header.");
  return rows.map((row) =>
    Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""])),
  );
}

function sitemapPaths(): string[] {
  return sitemap()
    .map((entry) => new URL(entry.url).pathname)
    .sort();
}

function articleSlugs(): string[] {
  return getPublicDiscoveryNewsArticles()
    .map((article) => article.slug)
    .sort();
}

function indexableArticleSlugs(): string[] {
  return getIndexablePublicNewsArticles()
    .map((article) => article.slug)
    .sort();
}

function newsSlugsFromSitemap(paths: readonly string[]): string[] {
  return paths
    .filter((pathname) => pathname.startsWith("/news/"))
    .map((pathname) => pathname.slice("/news/".length))
    .sort();
}

function hasExplicitLegacyLifecycleEntry(slug: string): boolean {
  return getNewsroomLifecycle(`/news/${slug}`) !== null;
}

function expectedWorkflowAutoApprove(
  eventName: "schedule" | "workflow_dispatch",
  curatedCandidateKey: "none" | "reviewed-candidate",
  candidateKey: "auto" | "manual-candidate",
): "0" | "1" {
  if (eventName === "workflow_dispatch" && curatedCandidateKey !== "none") {
    return "1";
  }
  if (eventName === "workflow_dispatch" && candidateKey !== "auto") {
    return "0";
  }
  return "1";
}

function expectedWorkflowDraftEnabled(
  eventName: "schedule" | "workflow_dispatch",
  publicationOnly: boolean,
  curatedCandidateKey: "none" | "reviewed-candidate",
): "0" | "1" {
  return eventName === "workflow_dispatch" &&
    (publicationOnly || curatedCandidateKey !== "none")
    ? "0"
    : "1";
}

function expectedWorkflowCuratedPublication(
  eventName: "schedule" | "workflow_dispatch",
  curatedCandidateKey: "none" | "reviewed-candidate",
): "0" | "1" {
  return eventName === "workflow_dispatch" &&
    curatedCandidateKey !== "none"
    ? "1"
    : "0";
}

function workflowEnvironmentLine(workflow: string, name: string): string {
  const matches = workflow
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.startsWith(`${name}:`));
  assert.equal(matches.length, 1, `${name} must occur exactly once.`);
  return matches[0];
}

async function configuredRedirects(): Promise<Redirect[]> {
  if (typeof nextConfig.redirects !== "function") {
    throw new Error("next.config.ts has no redirects function.");
  }
  return (await nextConfig.redirects()) as Redirect[];
}

function withCutover<T>(enabled: boolean, action: () => T): T {
  const original = process.env[NEWSROOM_LIFECYCLE_CUTOVER_ENV];
  try {
    if (enabled) {
      process.env[NEWSROOM_LIFECYCLE_CUTOVER_ENV] = "1";
    } else {
      delete process.env[NEWSROOM_LIFECYCLE_CUTOVER_ENV];
    }
    return action();
  } finally {
    if (original === undefined) {
      delete process.env[NEWSROOM_LIFECYCLE_CUTOVER_ENV];
    } else {
      process.env[NEWSROOM_LIFECYCLE_CUTOVER_ENV] = original;
    }
  }
}

function withEvidenceHoldPreview<T>(
  enabled: boolean,
  vercelEnvironment: string | undefined,
  action: () => T,
): T {
  const originalPreview = process.env[NEWSROOM_EVIDENCE_HOLD_PREVIEW_ENV];
  const originalVercelEnvironment = process.env.VERCEL_ENV;
  try {
    if (enabled) {
      process.env[NEWSROOM_EVIDENCE_HOLD_PREVIEW_ENV] = "1";
    } else {
      delete process.env[NEWSROOM_EVIDENCE_HOLD_PREVIEW_ENV];
    }
    if (vercelEnvironment === undefined) {
      delete process.env.VERCEL_ENV;
    } else {
      process.env.VERCEL_ENV = vercelEnvironment;
    }
    return action();
  } finally {
    if (originalPreview === undefined) {
      delete process.env[NEWSROOM_EVIDENCE_HOLD_PREVIEW_ENV];
    } else {
      process.env[NEWSROOM_EVIDENCE_HOLD_PREVIEW_ENV] = originalPreview;
    }
    if (originalVercelEnvironment === undefined) {
      delete process.env.VERCEL_ENV;
    } else {
      process.env.VERCEL_ENV = originalVercelEnvironment;
    }
  }
}

async function redirectsWithCutover(enabled: boolean): Promise<Redirect[]> {
  const original = process.env[NEWSROOM_LIFECYCLE_CUTOVER_ENV];
  try {
    if (enabled) {
      process.env[NEWSROOM_LIFECYCLE_CUTOVER_ENV] = "1";
    } else {
      delete process.env[NEWSROOM_LIFECYCLE_CUTOVER_ENV];
    }
    return await configuredRedirects();
  } finally {
    if (original === undefined) {
      delete process.env[NEWSROOM_LIFECYCLE_CUTOVER_ENV];
    } else {
      process.env[NEWSROOM_LIFECYCLE_CUTOVER_ENV] = original;
    }
  }
}

async function main(): Promise<void> {
  const originalCutover = process.env[NEWSROOM_LIFECYCLE_CUTOVER_ENV];
  const originalEvidencePreview =
    process.env[NEWSROOM_EVIDENCE_HOLD_PREVIEW_ENV];
  const originalVercelEnvironment = process.env.VERCEL_ENV;
  const authority = source(AUTHORITY_PATH);
  const rows = parseCsv(authority);
  const primaryRows = rows.filter((row) => row.in_sitemap === "yes");

  assert.equal(rows.length, 130, "The authoritative lifecycle row count changed.");
  assert.equal(primaryRows.length, 79, "The primary lifecycle baseline changed.");
  assert.equal(Object.keys(PRIMARY_NEWSROOM_LIFECYCLE).length, 79);
  assert.equal(isNewsroomLifecycleCutoverEnabled({}), false);
  assert.equal(
    isNewsroomLifecycleCutoverEnabled({ [NEWSROOM_LIFECYCLE_CUTOVER_ENV]: "1" }),
    true,
  );
  for (const disabledValue of ["", "0", "true", " 1 ", "on"]) {
    assert.equal(
      isNewsroomLifecycleCutoverEnabled({
        [NEWSROOM_LIFECYCLE_CUTOVER_ENV]: disabledValue,
      }),
      false,
      `The lifecycle switch accepted ${JSON.stringify(disabledValue)}.`,
    );
  }
  assert.equal(isNewsroomEvidenceHoldPreviewEnabled({}), false);
  assert.equal(
    isNewsroomEvidenceHoldPreviewEnabled({
      [NEWSROOM_EVIDENCE_HOLD_PREVIEW_ENV]: "1",
      VERCEL_ENV: "preview",
    }),
    true,
  );
  assert.equal(
    isNewsroomEvidenceHoldPreviewEnabled({
      [NEWSROOM_EVIDENCE_HOLD_PREVIEW_ENV]: "1",
      VERCEL_ENV: "production",
    }),
    false,
  );
  for (const disabledValue of ["", "0", "true", " 1 ", "on"]) {
    assert.equal(
      isNewsroomEvidenceHoldPreviewEnabled({
        [NEWSROOM_EVIDENCE_HOLD_PREVIEW_ENV]: disabledValue,
        VERCEL_ENV: "preview",
      }),
      false,
      `The evidence-hold preview accepted ${JSON.stringify(disabledValue)}.`,
    );
  }

  const cutoverOff = withEvidenceHoldPreview(false, undefined, () =>
    withCutover(false, () => ({
      sitemapPaths: sitemapPaths(),
      publicArticleSlugs: articleSlugs(),
      indexableArticleSlugs: indexableArticleSlugs(),
      lifecycleRedirects: getReleasedNewsroomRedirects(),
    })),
  );
  const cutoverOn = withEvidenceHoldPreview(false, undefined, () =>
    withCutover(true, () => ({
      sitemapPaths: sitemapPaths(),
      publicArticleSlugs: articleSlugs(),
      lifecycleRedirects: getReleasedNewsroomRedirects().map((redirect) => ({
        source: redirect.source,
        destination: redirect.destination,
        statusCode: redirect.statusCode,
      })).sort((left, right) =>
        left.source < right.source ? -1 : left.source > right.source ? 1 : 0,
      ),
    })),
  );
  const evidencePreviewCutoverOff = withEvidenceHoldPreview(
    true,
    "preview",
    () =>
      withCutover(false, () => ({
        sitemapPaths: sitemapPaths(),
        publicArticleSlugs: articleSlugs(),
        indexableArticleSlugs: indexableArticleSlugs(),
        lifecycleRedirects: getReleasedNewsroomRedirects(),
      })),
  );
  const evidencePreviewCutoverOn = withEvidenceHoldPreview(
    true,
    "preview",
    () =>
      withCutover(true, () => ({
        sitemapPaths: sitemapPaths(),
        publicArticleSlugs: articleSlugs(),
        lifecycleRedirects: getReleasedNewsroomRedirects(),
      })),
  );
  const productionFailClosed = withEvidenceHoldPreview(
    true,
    "production",
    () =>
      withCutover(false, () => ({
        sitemapPaths: sitemapPaths(),
        publicArticleSlugs: articleSlugs(),
        indexableArticleSlugs: indexableArticleSlugs(),
        lifecycleRedirects: getReleasedNewsroomRedirects(),
      })),
  );
  const configuredOff = await redirectsWithCutover(false);
  const configuredOn = await redirectsWithCutover(true);

  const evidenceHoldSlugs = new Set(NEWSROOM_EVIDENCE_HOLD_SLUGS);
  const sortedEvidenceHoldSlugs = [...evidenceHoldSlugs].sort();
  const legacyPublishedArticles = PUBLISHED_NEWS_ARTICLES.filter((article) =>
    hasExplicitLegacyLifecycleEntry(article.slug),
  );
  const additivePublishedArticles = PUBLISHED_NEWS_ARTICLES.filter(
    (article) => !hasExplicitLegacyLifecycleEntry(article.slug),
  );
  const legacyIndexableArticles = INDEXABLE_NEWS_ARTICLES.filter((article) =>
    hasExplicitLegacyLifecycleEntry(article.slug),
  );
  const additiveIndexableArticles = INDEXABLE_NEWS_ARTICLES.filter(
    (article) => !hasExplicitLegacyLifecycleEntry(article.slug),
  );
  const legacyEvidenceCertifiedArticles =
    EVIDENCE_CERTIFIED_INDEXABLE_NEWS_ARTICLES.filter((article) =>
      hasExplicitLegacyLifecycleEntry(article.slug),
    );
  const additiveEvidenceCertifiedArticles =
    EVIDENCE_CERTIFIED_INDEXABLE_NEWS_ARTICLES.filter(
      (article) => !hasExplicitLegacyLifecycleEntry(article.slug),
    );
  const additivePublishedArticlePaths = additivePublishedArticles.map(
    (article) => `/news/${article.slug}`,
  );
  const additiveIndexableArticlePaths = additiveIndexableArticles.map(
    (article) => `/news/${article.slug}`,
  );
  const currentPublicAuthorityPaths = [
    ...new Set([
      ...primaryRows.map((row) => row.current_url),
      ...additivePublishedArticlePaths,
    ]),
  ].sort();
  const currentReleaseRedirectSources = new Set<string>(
    CURRENT_RELEASE_NEWSROOM_REDIRECT_SOURCES,
  );
  const defaultReleasePublicAuthorityPaths = currentPublicAuthorityPaths.filter(
    (pathname) => !currentReleaseRedirectSources.has(pathname),
  );
  const releasedLegacyPaths = primaryRows
    .filter(
      (row) => row.disposition === "KEEP" || row.disposition === "IMPROVE",
    )
    .map((row) => row.current_url);
  const releasedAuthorityPaths = [
    ...new Set([...releasedLegacyPaths, ...additiveIndexableArticlePaths]),
  ].sort();
  const expectedPublishedSlugs = PUBLISHED_NEWS_ARTICLES.filter(
    (article) =>
      !currentReleaseRedirectSources.has(`/news/${article.slug}`),
  )
    .map((article) => article.slug)
    .sort();
  const currentReleaseRedirectSourceSlugs =
    CURRENT_RELEASE_NEWSROOM_REDIRECT_SOURCES.map((source) =>
      source.slice("/news/".length),
    );
  const expectedIndexableSlugs = INDEXABLE_NEWS_ARTICLES.map(
    (article) => article.slug,
  ).sort();
  const expectedEvidencePreviewPublishedSlugs = PUBLISHED_NEWS_ARTICLES.filter(
    (article) =>
      !evidenceHoldSlugs.has(article.slug) &&
      !currentReleaseRedirectSources.has(`/news/${article.slug}`),
  )
    .map((article) => article.slug)
    .sort();
  const certifiedArticleSlugs =
    EVIDENCE_CERTIFIED_INDEXABLE_NEWS_ARTICLES.map(
      (article) => article.slug,
    ).sort();
  const certifiedArticlePaths = certifiedArticleSlugs.map(
    (slug) => `/news/${slug}`,
  );
  const releasedStaticPaths = releasedLegacyPaths.filter(
    (pathname) => !pathname.startsWith("/news/"),
  );
  const evidencePreviewReleasedPaths = [
    ...releasedStaticPaths,
    ...certifiedArticlePaths,
  ].sort();

  assert.equal(
    legacyPublishedArticles.length,
    41,
    "The frozen published legacy-article baseline changed.",
  );
  assert.equal(
    legacyIndexableArticles.length,
    26,
    "The frozen indexable legacy-article baseline changed.",
  );
  assert.equal(
    legacyEvidenceCertifiedArticles.length,
    2,
    "The frozen evidence-certified legacy-article baseline changed.",
  );
  assert.deepEqual(
    cutoverOff.sitemapPaths,
    defaultReleasePublicAuthorityPaths,
    "Default-release sitemap drifted from the frozen legacy authority plus reviewed daily publications minus the released duplicate.",
  );
  assert.equal(
    cutoverOff.publicArticleSlugs.length,
    expectedPublishedSlugs.length,
  );
  assert.deepEqual(
    cutoverOff.publicArticleSlugs,
    expectedPublishedSlugs,
  );
  assert.ok(
    currentReleaseRedirectSourceSlugs.every(
      (slug) => !cutoverOff.indexableArticleSlugs.includes(slug),
    ),
    "Both released redirect sources must be excluded from central discovery.",
  );
  assert.ok(
    expectedIndexableSlugs.every((slug) =>
      cutoverOff.indexableArticleSlugs.includes(slug),
    ),
    "Default central discovery must retain every lifecycle-approved indexable article.",
  );
  assert.ok(
    cutoverOff.indexableArticleSlugs.every((slug) =>
      defaultReleasePublicAuthorityPaths.includes(`/news/${slug}`),
    ),
    "Default central discovery must remain inside the exact default-release authority.",
  );
  assert.deepEqual(
    cutoverOff.lifecycleRedirects,
    CURRENT_RELEASE_NEWSROOM_REDIRECTS,
    "The default release must expose only the two reviewed duplicate redirects.",
  );
  assert.deepEqual(CURRENT_RELEASE_NEWSROOM_REDIRECTS, [
    {
      source: CURRENT_RELEASE_NEWSROOM_REDIRECT_SOURCE,
      destination:
        "/news/2026-06-23-dubai-launches-flexi-rent-12-landlords-offer-monthly-instalm",
      statusCode: 301,
    },
    {
      source: CURRENT_RELEASE_ALDAR_REDIRECT_SOURCE,
      destination: CURRENT_RELEASE_ALDAR_REDIRECT_DESTINATION,
      statusCode: 301,
    },
  ]);
  assert.deepEqual(
    cutoverOn.sitemapPaths,
    releasedAuthorityPaths,
    "Cutover sitemap drifted from legacy KEEP/IMPROVE paths plus reviewed daily publications.",
  );
  assert.deepEqual(cutoverOn.publicArticleSlugs, expectedIndexableSlugs);
  assert.equal(cutoverOn.lifecycleRedirects.length, 32);
  assert.equal(FULL_RELEASE_NEWSROOM_REDIRECTS.length, 32);
  assert.deepEqual(
    evidencePreviewCutoverOff.publicArticleSlugs,
    expectedEvidencePreviewPublishedSlugs,
  );
  assert.deepEqual(
    newsSlugsFromSitemap(evidencePreviewCutoverOff.sitemapPaths),
    evidencePreviewCutoverOff.indexableArticleSlugs,
    "Evidence preview sitemap must contain exactly the mode's indexable article projection.",
  );
  assert.equal(
    new Set(evidencePreviewCutoverOff.sitemapPaths).size,
    evidencePreviewCutoverOff.sitemapPaths.length,
    "Evidence preview sitemap contains duplicate paths.",
  );
  assert.ok(
    evidencePreviewCutoverOff.sitemapPaths
      .filter((pathname) => !pathname.startsWith("/news/"))
      .every((pathname) =>
        primaryRows.some((row) => row.current_url === pathname),
      ),
    "Evidence preview sitemap introduced a non-news path outside the frozen legacy authority.",
  );
  assert.ok(
    sortedEvidenceHoldSlugs.every(
      (slug) =>
        !evidencePreviewCutoverOff.sitemapPaths.includes(`/news/${slug}`),
    ),
    "Evidence preview sitemap exposed an evidence-held article.",
  );
  assert.deepEqual(
    evidencePreviewCutoverOff.lifecycleRedirects,
    CURRENT_RELEASE_NEWSROOM_REDIRECTS,
  );
  assert.deepEqual(
    evidencePreviewCutoverOn.sitemapPaths,
    evidencePreviewReleasedPaths,
    "Evidence preview cutover sitemap must contain only released static paths and evidence-certified articles.",
  );
  assert.equal(
    evidencePreviewCutoverOn.publicArticleSlugs.length,
    certifiedArticleSlugs.length,
  );
  assert.deepEqual(
    evidencePreviewCutoverOn.publicArticleSlugs,
    certifiedArticleSlugs,
    "Evidence preview plus lifecycle cutover must expose exactly the evidence-certified article set.",
  );
  assert.equal(evidencePreviewCutoverOn.lifecycleRedirects.length, 32);
  assert.deepEqual(
    productionFailClosed,
    cutoverOff,
    "Production must ignore the preview-only evidence flag and preserve flag-off discovery.",
  );
  assert.equal(NEWSROOM_EVIDENCE_HOLD_SLUGS.length, 24);
  assert.equal(evidenceHoldSlugs.size, 24);
  assert.equal(
    EVIDENCE_CERTIFIED_INDEXABLE_NEWS_ARTICLES.length,
    2 + additiveEvidenceCertifiedArticles.length,
  );
  assert.equal(NEWSROOM_EXACT_REDIRECTS.length, 31);
  assert.equal(NEWSROOM_RELEASE_REMOVAL_CANDIDATES.length, 6);
  assert.equal(Object.keys(NEWSROOM_HELD_REDIRECTS).length, 3);
  const configuredDefaultLifecycleRedirects = configuredOff.filter(
    (redirect) => currentReleaseRedirectSources.has(redirect.source),
  );
  assert.deepEqual(
    configuredDefaultLifecycleRedirects,
    CURRENT_RELEASE_NEWSROOM_REDIRECTS.map(
      ({ source, destination, statusCode }) => ({
        source,
        destination: canonicalNewsroomRedirectDestination(destination),
        statusCode,
      }),
    ),
  );
  for (const redirect of configuredDefaultLifecycleRedirects) {
    const destination = new URL(redirect.destination);
    assert.equal(destination.origin, "https://news.investwithraj.com");
    assert.ok(
      !FULL_RELEASE_NEWSROOM_REDIRECTS.some(
        ({ source }) => source === destination.pathname,
      ),
      `${redirect.source} must reach its final canonical destination in one hop.`,
    );
  }
  assert.equal(
    NEWSROOM_EXACT_REDIRECTS.filter(
      ({ source }) => source !== CURRENT_RELEASE_NEWSROOM_REDIRECT_SOURCE,
    ).length,
    30,
  );
  assert.ok(
    NEWSROOM_EXACT_REDIRECTS.filter(
      ({ source }) => source !== CURRENT_RELEASE_NEWSROOM_REDIRECT_SOURCE,
    ).every(
      ({ source }) =>
        !configuredDefaultLifecycleRedirects.some(
          (redirect) => redirect.source === source,
        ),
    ),
    "Every other lifecycle redirect must remain behind the wider cutover gate.",
  );
  assert.ok(
    NEWSROOM_RELEASE_REMOVAL_CANDIDATES.every(
      (pathname) => !isReleasedNewsroomRemovalPath(pathname, {}),
    ),
    "Every lifecycle removal must remain behind the wider cutover gate.",
  );
  assert.equal(
    configuredOn.filter((redirect) =>
      NEWSROOM_EXACT_REDIRECTS.some((candidate) => candidate.source === redirect.source),
    ).length,
    31,
  );
  assert.equal(
    configuredOn.filter((redirect) =>
      FULL_RELEASE_NEWSROOM_REDIRECTS.some(
        (candidate) => candidate.source === redirect.source,
      ),
    ).length,
    32,
  );

  const missingContentHashSlugs = INDEXABLE_NEWS_ARTICLES.filter(
    (article) => !article.publicationContentHash,
  )
    .map((article) => article.slug)
    .sort();
  const oneSourceSlugs = INDEXABLE_NEWS_ARTICLES.filter(
    (article) => article.citations.length === 1,
  )
    .map((article) => article.slug)
    .sort();
  const legacyMissingContentHashSlugs = legacyIndexableArticles.filter(
    (article) => !article.publicationContentHash,
  )
    .map((article) => article.slug)
    .sort();
  const additiveMissingContentHashSlugs = additiveIndexableArticles.filter(
    (article) => !article.publicationContentHash,
  )
    .map((article) => article.slug)
    .sort();
  const legacyOneSourceSlugs = legacyIndexableArticles.filter(
    (article) => article.citations.length === 1,
  )
    .map((article) => article.slug)
    .sort();
  const additiveOneSourceSlugs = additiveIndexableArticles.filter(
    (article) => article.citations.length === 1,
  )
    .map((article) => article.slug)
    .sort();
  const additiveEvidenceCertifiedSlugSet = new Set(
    additiveEvidenceCertifiedArticles.map((article) => article.slug),
  );
  assert.equal(
    INDEXABLE_NEWS_ARTICLES.length,
    26 + additiveIndexableArticles.length,
  );
  assert.equal(legacyMissingContentHashSlugs.length, 24);
  assert.deepEqual(
    legacyMissingContentHashSlugs,
    sortedEvidenceHoldSlugs,
    "The frozen legacy content-hash debt must match the explicit evidence-hold registry.",
  );
  assert.deepEqual(
    additiveMissingContentHashSlugs,
    [],
    "A reviewed additive publication must have a publication content hash.",
  );
  assert.deepEqual(
    missingContentHashSlugs,
    sortedEvidenceHoldSlugs,
    "Every indexable article without a content hash must be explicitly evidence-held.",
  );
  assert.equal(legacyOneSourceSlugs.length, 7);
  assert.ok(
    additiveOneSourceSlugs.every((slug) =>
      additiveEvidenceCertifiedSlugSet.has(slug),
    ),
    "An additive one-source publication must be certified under the current evidence policy.",
  );
  assert.equal(
    oneSourceSlugs.length,
    legacyOneSourceSlugs.length + additiveOneSourceSlugs.length,
  );

  const launch = source("LAUNCH.md");
  const runbook = source("RUNBOOK.md");
  const backendMap = source("docs/BACKEND-MAP.md");
  const workflow = source(".github/workflows/news-cron.yml");
  const draftOnce = source("scripts/draft-once.ts");
  const vercelConfig = source("vercel.json");
  const watchdogRoute = source("app/api/cron/news-watchdog/route.ts");
  const schedulerLedger = source("lib/news-scheduler/ledger.ts");
  const schedulerWatchdog = source("lib/news-scheduler/watchdog.ts");
  const publicationDayLedger = source(
    "lib/news-scheduler/publication-day-ledger.ts",
  );
  const publishRoute = source("app/api/news/draft/[id]/publish/route.ts");
  const lifecycleRelease = source("docs/migration/newsroom-lifecycle-release.md");
  for (const document of [launch, runbook, backendMap]) {
    assert.match(document, /NEWSROOM_LIFECYCLE_CUTOVER=1/u);
    assert.match(document, CURRENT_EVIDENCE_POLICY_LABEL);
    assert.doesNotMatch(document, STALE_EVIDENCE_POLICY_LABEL);
    assert.match(document, /server credential/iu);
    assert.match(document, /24[\s\S]{0,80}?content hash/iu);
    assert.match(document, /7[\s\S]{0,80}?one-source/iu);
    assert.match(document, /six[\s\S]{0,120}?410/iu);
    assert.match(document, /NEWSROOM_EVIDENCE_HOLD_PREVIEW=1/u);
    assert.match(document, /default[\s\S]{0,60}?off/iu);
    assert.match(document, /production[\s\S]{0,100}?fail(?:s)? closed/iu);
    assert.match(document, /baselines, not ceilings[\s\S]{0,100}?additive/iu);
    assert.match(document, /79-path[\s\S]{0,120}?additive\s+published/iu);
    assert.match(
      document,
      /31-path KEEP\/IMPROVE[\s\S]{0,120}?additive\s+indexable/iu,
    );
    assert.match(document, /fixed total[\s\S]{0,160}?near-duplicate/iu);
    assert.match(document, /published registry[\s\S]{0,100}?24 held/iu);
    assert.match(
      document,
      /evidence-certified indexable set[\s\S]{0,140}?five released[\s\S]{0,30}?static/iu,
    );
  }
  assert.doesNotMatch(
    `${launch}\n${backendMap}`,
    /server credential can stage content, but it cannot publish|There is no automatic-publish branch/iu,
  );
  assert.equal(
    workflowEnvironmentLine(workflow, "AUTO_APPROVE"),
    "AUTO_APPROVE: ${{ github.event_name == 'workflow_dispatch' && inputs.curated_candidate_key != 'none' && '1' || (github.event_name == 'workflow_dispatch' && inputs.candidate_key != 'auto' && '0' || '1') }}",
    "AUTO_APPROVE must retain the exact bounded scheduled, curated and manual-candidate policy.",
  );
  assert.equal(
    workflowEnvironmentLine(workflow, "DRAFT_ENABLED"),
    "DRAFT_ENABLED: ${{ github.event_name == 'workflow_dispatch' && (inputs.publication_only || inputs.curated_candidate_key != 'none') && '0' || '1' }}",
  );
  assert.equal(
    workflowEnvironmentLine(workflow, "CURATED_PUBLICATION"),
    "CURATED_PUBLICATION: ${{ github.event_name == 'workflow_dispatch' && inputs.curated_candidate_key != 'none' && '1' || '0' }}",
  );
  assert.equal(
    workflowEnvironmentLine(workflow, "AUTO_PUBLISH_LIMIT"),
    'AUTO_PUBLISH_LIMIT: "1"',
  );
  assert.equal(
    workflowEnvironmentLine(workflow, "AUTOMATED_MORNING_LANE"),
    "AUTOMATED_MORNING_LANE: ${{ github.event_name == 'schedule' && '1' || (inputs.morning_date != '' && '1' || '0') }}",
  );
  assert.equal(
    workflowEnvironmentLine(workflow, "MORNING_DATE"),
    "MORNING_DATE: ${{ inputs.morning_date || '' }}",
  );
  assert.equal(
    workflowEnvironmentLine(workflow, "AUTO_APPROVE_TARGET_DRAFT_ID"),
    "AUTO_APPROVE_TARGET_DRAFT_ID: ${{ steps.curated.outputs.draft_id }}",
  );
  assert.equal(
    workflowEnvironmentLine(workflow, "AUTO_APPROVE_TARGET_CONTENT_HASH"),
    "AUTO_APPROVE_TARGET_CONTENT_HASH: ${{ steps.curated.outputs.content_hash }}",
  );
  assert.equal(
    workflowEnvironmentLine(workflow, "AUTO_APPROVE_TARGET_SLUG"),
    "AUTO_APPROVE_TARGET_SLUG: ${{ steps.curated.outputs.slug }}",
  );
  assert.equal(
    workflow
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter(
        (line) =>
          line ===
          "CURATED_CANDIDATE_KEY: ${{ inputs.curated_candidate_key }}",
      ).length,
    2,
    "The curated candidate key must bind both staging and publication.",
  );
  assert.equal(expectedWorkflowAutoApprove("schedule", "none", "auto"), "1");
  assert.equal(expectedWorkflowDraftEnabled("schedule", false, "none"), "1");
  assert.equal(expectedWorkflowCuratedPublication("schedule", "none"), "0");
  assert.equal(
    expectedWorkflowAutoApprove(
      "workflow_dispatch",
      "reviewed-candidate",
      "auto",
    ),
    "1",
  );
  assert.equal(
    expectedWorkflowDraftEnabled(
      "workflow_dispatch",
      false,
      "reviewed-candidate",
    ),
    "0",
  );
  assert.equal(
    expectedWorkflowCuratedPublication(
      "workflow_dispatch",
      "reviewed-candidate",
    ),
    "1",
  );
  assert.equal(
    expectedWorkflowAutoApprove(
      "workflow_dispatch",
      "none",
      "manual-candidate",
    ),
    "0",
  );
  assert.equal(
    expectedWorkflowDraftEnabled("workflow_dispatch", false, "none"),
    "1",
  );
  assert.equal(
    expectedWorkflowCuratedPublication("workflow_dispatch", "none"),
    "0",
  );
  assert.equal(
    expectedWorkflowAutoApprove("workflow_dispatch", "none", "auto"),
    "1",
  );
  assert.equal(
    expectedWorkflowDraftEnabled("workflow_dispatch", true, "none"),
    "0",
  );
  assert.match(
    draftOnce,
    /Curated publication requires auto-approval plus an exact candidate key, slug, staged draft ID and content hash/u,
  );
  assert.match(
    draftOnce,
    /targetDraftId: curatedPublication \? targetDraftId : undefined,[\s\S]{0,100}?targetContentHash: curatedPublication \? targetContentHash : undefined/u,
  );
  assert.match(
    draftOnce,
    /assertCuratedPublicationOutcome\([\s\S]{0,100}?curatedCandidateKey \?\? "",[\s\S]{0,100}?targetSlug \?\? "",[\s\S]{0,100}?summary/u,
  );
  assert.equal(
    (workflow.match(/cron: "37 1 \* \* \*"/gu) ?? []).length,
    1,
    "The primary GitHub run must remain at 05:37 Asia/Dubai.",
  );
  assert.equal(
    (workflow.match(/cron: "17 5 \* \* \*"/gu) ?? []).length,
    1,
    "The recovery GitHub run must remain at 09:17 Asia/Dubai.",
  );
  assert.match(workflow, /group: news-cron-production/u);
  assert.match(workflow, /morning_date:[\s\S]{0,260}?type: string/u);
  assert.match(workflow, /npx tsx scripts\/test-news-scheduler\.ts/u);
  assert.doesNotMatch(workflow, /cron: "7 3 \* \* \*"/u);
  assert.deepEqual(JSON.parse(vercelConfig).crons, [
    { path: "/api/cron/news-watchdog", schedule: "17 3 * * *" },
  ]);
  assert.match(
    watchdogRoute,
    /authorizeServerMutation\(request, \{ allowCronBearer: true \}\)/u,
  );
  assert.match(watchdogRoute, /auth\.credential !== "cron"/u);
  assert.match(schedulerWatchdog, /ENABLE_NEWS_WATCHDOG === "1"/u);
  assert.match(schedulerWatchdog, /GITHUB_ACTIONS_DISPATCH_TOKEN/u);
  assert.match(
    schedulerWatchdog,
    /inputs: \{ morning_date: input\.morningDate \}/u,
  );
  assert.match(schedulerWatchdog, /ref: NEWS_WORKFLOW_REF/u);
  assert.match(schedulerLedger, /status = "dispatched"/u);
  assert.match(schedulerLedger, /status = "completed"/u);
  assert.match(schedulerLedger, /status = "retryable"/u);
  assert.match(publicationDayLedger, /current\.status == "committing"/u);
  assert.match(publicationDayLedger, /current\.status = "retryable"/u);
  assert.match(publicationDayLedger, /current\.status = "completed"/u);
  assert.match(
    publicationDayLedger,
    /if current\.status == "completed" then return 2 end/u,
    "A completed Dubai-day receipt must remain immutable.",
  );
  assert.match(draftOnce, /guardAutomatedMorningPublication/u);
  assert.match(draftOnce, /repositoryArticles: NEWS_ARTICLES/u);
  assert.equal(
    (draftOnce.match(/guardAutomatedMorningPublication\(/gu) ?? []).length,
    2,
    "The automated lane must recheck coverage immediately before publication.",
  );
  assert.match(
    draftOnce,
    /morningGuard\.automated && morningGuard\.covered[\s\S]{0,220}?return;/u,
  );
  assert.match(
    draftOnce,
    /const finalMorningGuard = await guardAutomatedMorningPublication\([\s\S]{0,300}?repositoryArticles: NEWS_ARTICLES[\s\S]{0,300}?finalMorningGuard\.automated && finalMorningGuard\.covered[\s\S]{0,220}?return;/u,
  );
  assert.match(
    draftOnce,
    /runAutoApprove\(\{[\s\S]{0,900}?requiredPublishedDubaiDate,/u,
  );
  assert.match(publishRoute, /const automated = auth\.credential === "server-secret"/u);
  const dayClaimIndex = publishRoute.indexOf("await ledger.claim(identity)");
  const draftClaimIndex = publishRoute.indexOf("await claimDraftPublication(id");
  const idempotentBranchIndex = publishRoute.indexOf(
    "claimedEvidence &&",
    draftClaimIndex,
  );
  const idempotentCompletionIndex = publishRoute.indexOf(
    "automatedDayCompleted = await automatedDay.ledger.complete",
    idempotentBranchIndex,
  );
  const commitBarrierIndex = publishRoute.indexOf(
    "await automatedDay.ledger.markCommitStarted",
    idempotentCompletionIndex,
  );
  const githubCommitIndex = publishRoute.indexOf("await publishArticleCommit(");
  assert.ok(dayClaimIndex >= 0);
  assert.ok(draftClaimIndex > dayClaimIndex);
  assert.ok(idempotentBranchIndex > draftClaimIndex);
  assert.ok(idempotentCompletionIndex > idempotentBranchIndex);
  assert.ok(commitBarrierIndex > draftClaimIndex);
  assert.ok(githubCommitIndex > commitBarrierIndex);
  assert.match(publishRoute, /dayClaim\.status === "busy"[\s\S]{0,260}?409/u);
  assert.match(
    publishRoute,
    /finally \{[\s\S]{0,180}?automatedDay && !automatedCommitBoundaryCrossed[\s\S]{0,220}?releaseBeforeCommit/u,
    "Only a definite pre-GitHub failure may reopen the immutable draft reservation.",
  );
  assert.match(lifecycleRelease, /direct 410[\s\S]{0,20}?Gone response/iu);

  process.env[NEWSROOM_LIFECYCLE_CUTOVER_ENV] = "1";
  try {
    for (const pathname of NEWSROOM_RELEASE_REMOVAL_CANDIDATES) {
      const response = await proxy(
        new NextRequest(`https://news.investwithraj.com${pathname}`),
      );
      assert.equal(response.status, 410);
      assert.equal(response.headers.get("location"), null);
      assert.equal(
        response.headers.get("x-robots-tag"),
        "noindex, nofollow, noarchive",
      );
    }
  } finally {
    if (originalCutover === undefined) {
      delete process.env[NEWSROOM_LIFECYCLE_CUTOVER_ENV];
    } else {
      process.env[NEWSROOM_LIFECYCLE_CUTOVER_ENV] = originalCutover;
    }
  }

  const heldRedirects = Object.entries(NEWSROOM_HELD_REDIRECTS)
    .map(([sourcePath, hold]) => ({ source: sourcePath, ...hold }))
    .sort((left, right) =>
      left.source < right.source ? -1 : left.source > right.source ? 1 : 0,
    );
  const mediumConfidenceRemovalCandidates = [
    "/news/2026-06-29-dar-global-launches-19-fendi-casa-villas-at-oman-s-aida-clif",
    "/news/2026-07-12-kuwait-property-deals-fall-13-as-land-fees-and-war-chill-h1-",
  ] as const;
  assert.ok(
    mediumConfidenceRemovalCandidates.every((pathname) =>
      NEWSROOM_RELEASE_REMOVAL_CANDIDATES.includes(pathname),
    ),
  );
  const releaseBlockers = [
    {
      code: "HELD_REDIRECTS",
      count: heldRedirects.length,
      releaseRule: "Do not activate these redirects until their recorded hold is resolved.",
    },
    {
      code: "LEGACY_CONTENT_HASH",
      count: missingContentHashSlugs.length,
      releaseRule: `These matrix-retained articles are not evidence-policy-v${CURRENT_EVIDENCE_POLICY_VERSION} certified; keep the debt explicit and re-review before claiming full evidence migration.`,
    },
    {
      code: "LEGACY_ONE_SOURCE",
      count: legacyOneSourceSlugs.length,
      releaseRule:
        "These legacy articles require source repair or an explicit noindex decision before claiming universal two-publisher coverage.",
    },
    {
      code: "REMOVAL_DEMAND_CHECKS",
      count: NEWSROOM_RELEASE_REMOVAL_CANDIDATES.length,
      candidates: [...NEWSROOM_RELEASE_REMOVAL_CANDIDATES].sort(),
      mediumConfidenceCandidates: [...mediumConfidenceRemovalCandidates].sort(),
      releaseRule:
        "Do not activate the six 410 responses until Search Console, backlink/referral, analytics and access-log demand checks are attached; Kuwait and Fendi remain medium-confidence removals.",
    },
  ] as const;

  const manifest = {
    schemaVersion: "newsroom-offline-release-certification-v4",
    status: "offline-contract-valid-live-release-blocked",
    runtimeBehaviorChanged: true,
    authority: {
      path: AUTHORITY_PATH,
      sha256: createHash("sha256").update(authority).digest("hex"),
      rows: rows.length,
      primaryRows: primaryRows.length,
    },
    releaseSwitch: {
      environment: NEWSROOM_LIFECYCLE_CUTOVER_ENV,
      enabledValue: "1",
      defaultState: "off",
      evaluation: "build/release-time",
    },
    evidenceHoldPreview: {
      environment: NEWSROOM_EVIDENCE_HOLD_PREVIEW_ENV,
      enabledValue: "1",
      defaultState: "off",
      nonProductionOnly: true,
      productionFailClosed: true,
      authorizesRelease: false,
      heldArticleCount: NEWSROOM_EVIDENCE_HOLD_SLUGS.length,
      evidenceCertifiedIndexCandidateCount:
        EVIDENCE_CERTIFIED_INDEXABLE_NEWS_ARTICLES.length,
      cutoverOff: {
        sitemapCount: evidencePreviewCutoverOff.sitemapPaths.length,
        publicArticleCount: evidencePreviewCutoverOff.publicArticleSlugs.length,
        lifecycleRedirectCount:
          evidencePreviewCutoverOff.lifecycleRedirects.length,
      },
      cutoverOn: {
        sitemapCount: evidencePreviewCutoverOn.sitemapPaths.length,
        publicArticleCount: evidencePreviewCutoverOn.publicArticleSlugs.length,
        lifecycleRedirectCount:
          evidencePreviewCutoverOn.lifecycleRedirects.length,
      },
      productionWithFlag: {
        sitemapCount: productionFailClosed.sitemapPaths.length,
        publicArticleCount: productionFailClosed.publicArticleSlugs.length,
        lifecycleRedirectCount: productionFailClosed.lifecycleRedirects.length,
      },
    },
    evidencePolicy: {
      version: CURRENT_EVIDENCE_POLICY_VERSION,
      automatedPublication:
        "server-secret permitted only after the deterministic evidence policy passes",
      liveReleaseClaim: "blocked until external infrastructure and deployment are separately proven",
    },
    morningScheduler: {
      enabledByDefault: false,
      enableEnvironment: "ENABLE_NEWS_WATCHDOG=1",
      githubUtcSchedules: ["37 1 * * *", "17 5 * * *"],
      dubaiSchedules: ["05:37", "09:17"],
      vercelWatchdogUtcSchedule: "17 3 * * *",
      vercelWatchdogDubaiSchedule: "07:17",
      heavyExecution: "GitHub Actions only",
      maxWebsitePublicationsPerAutomatedDubaiDay: 1,
      publishBoundaryEnforcement:
        "atomic durable Dubai-day owner lease and commit-start barrier",
      socialDistribution: false,
    },
    cutoverOff: {
      sitemapCount: cutoverOff.sitemapPaths.length,
      sitemapPaths: cutoverOff.sitemapPaths,
      publicArticleCount: cutoverOff.publicArticleSlugs.length,
      publicArticleSlugs: cutoverOff.publicArticleSlugs,
      lifecycleRedirectCount: cutoverOff.lifecycleRedirects.length,
    },
    cutoverOn: {
      sitemapCount: cutoverOn.sitemapPaths.length,
      sitemapPaths: cutoverOn.sitemapPaths,
      publicArticleCount: cutoverOn.publicArticleSlugs.length,
      publicArticleSlugs: cutoverOn.publicArticleSlugs,
      lifecycleRedirectCount: cutoverOn.lifecycleRedirects.length,
      lifecycleRedirects: cutoverOn.lifecycleRedirects,
      removalResponse: {
        status: 410,
        candidates: [...NEWSROOM_RELEASE_REMOVAL_CANDIDATES].sort(),
        implementation: "exact-path proxy response",
        defaultState: "unchanged while cutover is off",
      },
    },
    heldRedirects,
    legacyEvidence: {
      indexCandidateCount: legacyIndexableArticles.length,
      currentPolicyContentHashCount: legacyEvidenceCertifiedArticles.length,
      missingContentHashCount: legacyMissingContentHashSlugs.length,
      missingContentHashSlugs: legacyMissingContentHashSlugs,
      oneSourceCount: legacyOneSourceSlugs.length,
      oneSourceSlugs: legacyOneSourceSlugs,
      certification: `legacy matrix retention only; ${legacyMissingContentHashSlugs.length} records remain outside evidence-policy-v${CURRENT_EVIDENCE_POLICY_VERSION} certification`,
    },
    additiveEvidence: {
      publishedCount: additivePublishedArticles.length,
      publishedSlugs: additivePublishedArticles
        .map((article) => article.slug)
        .sort(),
      indexCandidateCount: additiveIndexableArticles.length,
      currentPolicyContentHashCount: additiveEvidenceCertifiedArticles.length,
      missingContentHashCount: additiveMissingContentHashSlugs.length,
      oneSourceCount: additiveOneSourceSlugs.length,
      certification: `reviewed daily publications certified under evidence policy v${CURRENT_EVIDENCE_POLICY_VERSION}`,
    },
    blockers: releaseBlockers,
    excludedProof:
      "This offline certificate does not prove KV, secrets, GitHub, DNS, cron, build, deployment, indexing, Search Console, backlinks/referrals, analytics, access logs or provider connectivity.",
  } as const;

  assert.equal(
    manifest.evidencePolicy.version,
    CURRENT_EVIDENCE_POLICY_VERSION,
  );
  assert.equal(manifest.status, "offline-contract-valid-live-release-blocked");
  assert.equal(originalCutover, process.env[NEWSROOM_LIFECYCLE_CUTOVER_ENV]);
  assert.equal(
    originalEvidencePreview,
    process.env[NEWSROOM_EVIDENCE_HOLD_PREVIEW_ENV],
  );
  assert.equal(originalVercelEnvironment, process.env.VERCEL_ENV);

  console.log(JSON.stringify(manifest, null, 2));
  console.error(
    `Offline newsroom contract valid; live release remains blocked by ${heldRedirects.length} held redirects, ${missingContentHashSlugs.length} missing content hashes, ${legacyOneSourceSlugs.length} one-source legacy records and ${NEWSROOM_RELEASE_REMOVAL_CANDIDATES.length} removal demand checks.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
