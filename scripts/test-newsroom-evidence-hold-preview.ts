import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import sitemap from "../app/sitemap";
import { GET as getFront } from "../app/api/front/route";
import { GET as getNewsSitemap } from "../app/news-sitemap.xml/route";
import { GET as getRss } from "../app/rss.xml/route";
import { getIndexablePublicNewsArticles } from "../lib/news-discovery";
import {
  CURRENT_RELEASE_NEWSROOM_REDIRECT_SOURCES,
  FULL_RELEASE_NEWSROOM_REDIRECTS,
  NEWSROOM_EXACT_REDIRECTS,
  NEWSROOM_HELD_REDIRECTS,
  NEWSROOM_LIFECYCLE_CUTOVER_ENV,
  NEWSROOM_RELEASE_REMOVAL_CANDIDATES,
  PRIMARY_NEWSROOM_LIFECYCLE,
  getNewsroomLifecycle,
  getReleasedNewsroomRedirects,
} from "../lib/news-lifecycle";
import { selectDistinctArticles } from "../lib/news-editorial";
import {
  EVIDENCE_CERTIFIED_INDEXABLE_NEWS_ARTICLES,
  INDEXABLE_NEWS_ARTICLES,
  NEWSROOM_EVIDENCE_HOLD_PREVIEW_ENV,
  NEWSROOM_EVIDENCE_HOLD_SLUGS,
  PUBLISHED_NEWS_ARTICLES,
  PUBLIC_DEVELOPER_RECORDS,
  getPublicDiscoveryNewsArticles,
  isPublicDiscoveryNewsArticleSlug,
  isNewsroomEvidenceHeldArticleSlug,
  isNewsroomEvidenceHoldPreviewEnabled,
} from "../lib/public-content";

const HELD_PILOT =
  "2026-07-23-aldar-activates-aed-100-bn-marsa-al-saadiyat-saadiyat-island";
const DEFAULT_DEVELOPER_DIRECTORY_CANDIDATES = [
  "2026-06-11-emaar-unveils-dh200bn-masterplan-for-150-000-residents-in-du",
  "2026-07-23-aldar-activates-aed-100-bn-marsa-al-saadiyat-saadiyat-island",
  "2026-07-10-aldar-unveils-dh6bn-yas-point-1-600-residences-anchor-northe",
  "2026-06-10-cbd-and-dubai-holding-real-estate-launch-aed-157-9bn-backed-",
  "2026-07-09-modon-and-adib-launch-75-off-plan-financing-for-abu-dhabi-co",
  "2026-06-10-shangri-la-dubai-sells-for-dh1-1bn-as-sheikh-zayed-road-valu",
] as const;
const articlePageSource = readFileSync(
  resolve(process.cwd(), "app/news/[slug]/page.tsx"),
  "utf8",
);
const developerDirectorySource = readFileSync(
  resolve(process.cwd(), "app/developers/page.tsx"),
  "utf8",
);
const newsDiscoverySource = readFileSync(
  resolve(process.cwd(), "lib/news-discovery.ts"),
  "utf8",
);
const newsMetadataSource = readFileSync(
  resolve(process.cwd(), "lib/news-metadata.ts"),
  "utf8",
);

type Mode = Readonly<{
  vercelEnv?: string;
  evidencePreview: boolean;
  lifecycle: boolean;
}>;

async function withMode<T>(
  mode: Mode,
  action: () => T | Promise<T>,
): Promise<T> {
  const original = {
    vercelEnv: process.env.VERCEL_ENV,
    evidence: process.env[NEWSROOM_EVIDENCE_HOLD_PREVIEW_ENV],
    lifecycle: process.env[NEWSROOM_LIFECYCLE_CUTOVER_ENV],
  };
  try {
    if (mode.vercelEnv === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = mode.vercelEnv;
    if (mode.evidencePreview) {
      process.env[NEWSROOM_EVIDENCE_HOLD_PREVIEW_ENV] = "1";
    } else {
      delete process.env[NEWSROOM_EVIDENCE_HOLD_PREVIEW_ENV];
    }
    if (mode.lifecycle) {
      process.env[NEWSROOM_LIFECYCLE_CUTOVER_ENV] = "1";
    } else {
      delete process.env[NEWSROOM_LIFECYCLE_CUTOVER_ENV];
    }
    return await action();
  } finally {
    for (const [key, value] of [
      ["VERCEL_ENV", original.vercelEnv],
      [NEWSROOM_EVIDENCE_HOLD_PREVIEW_ENV, original.evidence],
      [NEWSROOM_LIFECYCLE_CUTOVER_ENV, original.lifecycle],
    ] as const) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

function state() {
  return {
    sitemapPaths: sitemap()
      .map((entry) => new URL(entry.url).pathname)
      .sort(),
    articleSlugs: getPublicDiscoveryNewsArticles()
      .map((article) => article.slug)
      .sort(),
    indexableArticleSlugs: getIndexablePublicNewsArticles()
      .map((article) => article.slug)
      .sort(),
    redirectSources: getReleasedNewsroomRedirects()
      .map((redirect) => redirect.source)
      .sort(),
  };
}

function newsSlugsFromSitemap(paths: readonly string[]): string[] {
  return paths
    .filter((pathname) => pathname.startsWith("/news/"))
    .map((pathname) => pathname.slice("/news/".length))
    .sort();
}

function developerDirectoryCandidateSlugs(): string[] {
  return selectDistinctArticles(
    PUBLIC_DEVELOPER_RECORDS.flatMap(({ reports }) => reports).filter(
      (article) => isPublicDiscoveryNewsArticleSlug(article.slug),
    ),
    8,
  ).map((article) => article.slug);
}

async function main(): Promise<void> {
  assert.equal(NEWSROOM_EVIDENCE_HOLD_SLUGS.length, 24);
  assert.equal(new Set(NEWSROOM_EVIDENCE_HOLD_SLUGS).size, 24);
  assert.ok(PUBLISHED_NEWS_ARTICLES.length >= 41);
  assert.ok(INDEXABLE_NEWS_ARTICLES.length >= 26);
  assert.ok(EVIDENCE_CERTIFIED_INDEXABLE_NEWS_ARTICLES.length >= 2);
  assert.ok(
    NEWSROOM_EVIDENCE_HOLD_SLUGS.every((slug) =>
      INDEXABLE_NEWS_ARTICLES.some((article) => article.slug === slug),
    ),
  );
  assert.ok(
    NEWSROOM_EVIDENCE_HOLD_SLUGS.every((slug) =>
      INDEXABLE_NEWS_ARTICLES.find((article) => article.slug === slug)
        ?.publicationContentHash === undefined,
    ),
  );
  const sortedEvidenceHoldSlugs = [...NEWSROOM_EVIDENCE_HOLD_SLUGS].sort();
  const missingContentHashSlugs = INDEXABLE_NEWS_ARTICLES.filter(
    (article) => !article.publicationContentHash,
  )
    .map((article) => article.slug)
    .sort();
  assert.deepEqual(
    missingContentHashSlugs,
    sortedEvidenceHoldSlugs,
    "Every indexable article without a content hash must be explicitly evidence-held.",
  );

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
  for (const disabled of ["", "0", "true", " 1 ", "on"]) {
    assert.equal(
      isNewsroomEvidenceHoldPreviewEnabled({
        [NEWSROOM_EVIDENCE_HOLD_PREVIEW_ENV]: disabled,
        VERCEL_ENV: "preview",
      }),
      false,
    );
  }

  const additivePublished = PUBLISHED_NEWS_ARTICLES.filter(
    (article) => !getNewsroomLifecycle(`/news/${article.slug}`),
  );
  const additiveIndexable = INDEXABLE_NEWS_ARTICLES.filter(
    (article) => !getNewsroomLifecycle(`/news/${article.slug}`),
  );
  const additiveCertified = EVIDENCE_CERTIFIED_INDEXABLE_NEWS_ARTICLES.filter(
    (article) => !getNewsroomLifecycle(`/news/${article.slug}`),
  );
  const legacyPublished = PUBLISHED_NEWS_ARTICLES.filter((article) =>
    getNewsroomLifecycle(`/news/${article.slug}`),
  );
  const legacyIndexable = INDEXABLE_NEWS_ARTICLES.filter((article) =>
    getNewsroomLifecycle(`/news/${article.slug}`),
  );
  assert.equal(legacyPublished.length, 41);
  assert.equal(legacyIndexable.length, 26);
  assert.deepEqual(
    additiveCertified.map((article) => article.slug).sort(),
    additiveIndexable.map((article) => article.slug).sort(),
    "Every additive index candidate must be evidence-certified.",
  );
  const currentReleaseSourceSlugs = new Set(
    CURRENT_RELEASE_NEWSROOM_REDIRECT_SOURCES.map((source) =>
      source.slice("/news/".length),
    ),
  );
  const expectedPublishedArticles = PUBLISHED_NEWS_ARTICLES.filter(
    (article) => !currentReleaseSourceSlugs.has(article.slug),
  );
  const expectedDefaultSitemapPaths = [
    ...new Set([
      ...Object.keys(PRIMARY_NEWSROOM_LIFECYCLE).filter(
        (pathname) =>
          !CURRENT_RELEASE_NEWSROOM_REDIRECT_SOURCES.includes(
            pathname as (typeof CURRENT_RELEASE_NEWSROOM_REDIRECT_SOURCES)[number],
          ),
      ),
      ...additivePublished
        .filter((article) => !currentReleaseSourceSlugs.has(article.slug))
        .map((article) => `/news/${article.slug}`),
    ]),
  ].sort();
  const expectedPublishedSlugs = expectedPublishedArticles.map(
    (article) => article.slug,
  ).sort();
  const expectedPreviewPublishedSlugs = expectedPublishedArticles.filter(
    (article) => !NEWSROOM_EVIDENCE_HOLD_SLUGS.includes(article.slug),
  )
    .map((article) => article.slug)
    .sort();
  const expectedCertifiedSlugs =
    EVIDENCE_CERTIFIED_INDEXABLE_NEWS_ARTICLES.map(
      (article) => article.slug,
    ).sort();
  const expectedPreviewCutoverSitemapPaths = [
    ...Object.entries(PRIMARY_NEWSROOM_LIFECYCLE)
      .filter(
        ([pathname, lifecycle]) =>
          !pathname.startsWith("/news/") &&
          (lifecycle.disposition === "KEEP" ||
            lifecycle.disposition === "IMPROVE"),
      )
      .map(([pathname]) => pathname),
    ...expectedCertifiedSlugs.map((slug) => `/news/${slug}`),
  ].sort();
  const defaultState = await withMode(
    { evidencePreview: false, lifecycle: false },
    state,
  );
  assert.deepEqual(defaultState.sitemapPaths, expectedDefaultSitemapPaths);
  assert.deepEqual(defaultState.articleSlugs, expectedPublishedSlugs);
  assert.deepEqual(
    newsSlugsFromSitemap(defaultState.sitemapPaths),
    defaultState.indexableArticleSlugs,
  );
  assert.deepEqual(
    defaultState.redirectSources,
    [...CURRENT_RELEASE_NEWSROOM_REDIRECT_SOURCES].sort(),
  );
  assert.deepEqual(
    await withMode(
      { vercelEnv: "production", evidencePreview: true, lifecycle: false },
      state,
    ),
    defaultState,
  );
  const evidencePreviewState = await withMode(
    { vercelEnv: "preview", evidencePreview: true, lifecycle: false },
    state,
  );
  assert.deepEqual(
    evidencePreviewState.articleSlugs,
    expectedPreviewPublishedSlugs,
  );
  assert.deepEqual(
    newsSlugsFromSitemap(evidencePreviewState.sitemapPaths),
    evidencePreviewState.indexableArticleSlugs,
  );
  assert.equal(
    new Set(evidencePreviewState.sitemapPaths).size,
    evidencePreviewState.sitemapPaths.length,
  );
  assert.ok(
    evidencePreviewState.sitemapPaths
      .filter((pathname) => !pathname.startsWith("/news/"))
      .every((pathname) =>
        Object.hasOwn(PRIMARY_NEWSROOM_LIFECYCLE, pathname),
      ),
  );
  assert.ok(
    sortedEvidenceHoldSlugs.every(
      (slug) =>
        !evidencePreviewState.sitemapPaths.includes(`/news/${slug}`),
    ),
  );
  assert.deepEqual(
    evidencePreviewState.redirectSources,
    [...CURRENT_RELEASE_NEWSROOM_REDIRECT_SOURCES].sort(),
  );
  const evidencePreviewCutoverState = await withMode(
    { vercelEnv: "preview", evidencePreview: true, lifecycle: true },
    state,
  );
  assert.deepEqual(
    evidencePreviewCutoverState.sitemapPaths,
    expectedPreviewCutoverSitemapPaths,
  );
  assert.deepEqual(
    evidencePreviewCutoverState.articleSlugs,
    expectedCertifiedSlugs,
  );
  assert.deepEqual(
    evidencePreviewCutoverState.indexableArticleSlugs,
    expectedCertifiedSlugs,
  );
  assert.deepEqual(
    evidencePreviewCutoverState.redirectSources,
    FULL_RELEASE_NEWSROOM_REDIRECTS.map((redirect) => redirect.source).sort(),
  );
  assert.equal(NEWSROOM_EXACT_REDIRECTS.length, 31);
  assert.equal(FULL_RELEASE_NEWSROOM_REDIRECTS.length, 32);
  assert.equal(Object.keys(NEWSROOM_HELD_REDIRECTS).length, 3);
  assert.equal(NEWSROOM_RELEASE_REMOVAL_CANDIDATES.length, 6);
  assert.match(
    articlePageSource,
    /import \{[\s\S]*isIndexablePublicNewsArticleSlug,[\s\S]*\} from "@\/lib\/news-discovery"/u,
  );
  assert.match(
    articlePageSource,
    /return newsArticleMetadata\(article\)/u,
  );
  assert.match(
    articlePageSource,
    /const indexEligible = isIndexablePublicNewsArticleSlug\(article\.slug\)/u,
  );
  assert.match(
    newsMetadataSource,
    /robots: \{[\s\S]*index: isIndexablePublicNewsArticleSlug\(article\.slug\),[\s\S]*follow: true/u,
  );
  assert.match(
    newsMetadataSource,
    /alternates: \{[\s\S]*canonical: url/u,
  );
  assert.match(
    newsDiscoverySource,
    /isNewsroomEvidenceHeldArticleSlug\(slug\)/u,
    "The shared indexability boundary must retain the evidence-hold exclusion.",
  );
  assert.match(articlePageSource, /const graph = indexEligible[\s\S]*\? asGraph\(/u);
  assert.match(
    developerDirectorySource,
    /PUBLIC_DEVELOPER_RECORDS\.flatMap\(\(\{ reports \}\) => reports\)\.filter\([\s\S]*isPublicDiscoveryNewsArticleSlug\(article\.slug\)/u,
  );

  const defaultDeveloperDirectoryCandidates = await withMode(
    { evidencePreview: false, lifecycle: false },
    developerDirectoryCandidateSlugs,
  );
  const productionDeveloperDirectoryCandidates = await withMode(
    { vercelEnv: "production", evidencePreview: true, lifecycle: false },
    developerDirectoryCandidateSlugs,
  );
  const previewDeveloperDirectoryCandidates = await withMode(
    { vercelEnv: "preview", evidencePreview: true, lifecycle: false },
    developerDirectoryCandidateSlugs,
  );
  const additivePublishedSlugSet = new Set(
    additivePublished.map((article) => article.slug),
  );
  const certifiedSlugSet = new Set(expectedCertifiedSlugs);
  const defaultLegacyDeveloperCandidates =
    defaultDeveloperDirectoryCandidates.filter(
      (slug) => !additivePublishedSlugSet.has(slug),
    );
  assert.deepEqual(
    defaultLegacyDeveloperCandidates,
    DEFAULT_DEVELOPER_DIRECTORY_CANDIDATES.slice(
      0,
      defaultLegacyDeveloperCandidates.length,
    ),
    "Reviewed daily additions may enter the directory, but the surviving legacy candidate order must not drift.",
  );
  assert.ok(
    defaultDeveloperDirectoryCandidates
      .filter((slug) => additivePublishedSlugSet.has(slug))
      .every((slug) => certifiedSlugSet.has(slug)),
    "An additive developer-directory candidate was not evidence-certified.",
  );
  assert.deepEqual(
    productionDeveloperDirectoryCandidates,
    defaultDeveloperDirectoryCandidates,
    "Production with the preview flag must preserve developer-directory candidates.",
  );
  const expectedPreviewDeveloperCandidates = selectDistinctArticles(
    PUBLIC_DEVELOPER_RECORDS.flatMap(({ reports }) => reports).filter(
      (article) => certifiedSlugSet.has(article.slug),
    ),
    8,
  ).map((article) => article.slug);
  assert.deepEqual(
    previewDeveloperDirectoryCandidates,
    expectedPreviewDeveloperCandidates,
    "Evidence preview must emit exactly the evidence-certified developer reports.",
  );
  assert.ok(
    previewDeveloperDirectoryCandidates.every(
      (slug) => !NEWSROOM_EVIDENCE_HOLD_SLUGS.includes(slug),
    ),
    "Evidence preview emitted a held developer-directory report.",
  );

  await withMode(
    { vercelEnv: "preview", evidencePreview: true, lifecycle: false },
    async () => {
      assert.equal(isNewsroomEvidenceHeldArticleSlug(HELD_PILOT), true);

      const front = (await getFront()) as Response;
      const frontPayload = (await front.json()) as { items: { slug: string }[] };
      assert.ok(
        frontPayload.items.every(
          (item) => !NEWSROOM_EVIDENCE_HOLD_SLUGS.includes(item.slug),
        ),
      );
      const rss = await getRss().text();
      assert.equal(
        [...rss.matchAll(/<guid isPermaLink="true">[^<]*\/news\/([^<]+)<\/guid>/gu)]
          .map((match) => match[1]).length,
        Math.min(
          30,
          expectedPreviewPublishedSlugs.length,
        ),
      );

      const originalNow = Date.now;
      const auditNow =
        new Date(
          EVIDENCE_CERTIFIED_INDEXABLE_NEWS_ARTICLES[0]!.publishedAt,
        ).getTime() +
        60 * 60 * 1_000;
      Date.now = () => auditNow;
      try {
        const newsSitemap = await getNewsSitemap().text();
        const slugs = [
          ...newsSitemap.matchAll(/<loc>[^<]*\/news\/([^<]+)<\/loc>/gu),
        ].map((match) => match[1]);
        assert.deepEqual(
          slugs.sort(),
          EVIDENCE_CERTIFIED_INDEXABLE_NEWS_ARTICLES.filter(
            (article) =>
              auditNow - new Date(article.publishedAt).getTime() <=
              48 * 60 * 60 * 1_000,
          )
            .map((article) => article.slug)
            .sort(),
        );
      } finally {
        Date.now = originalNow;
      }
    },
  );

  await withMode(
    { vercelEnv: "production", evidencePreview: true, lifecycle: false },
    () => {
      assert.equal(isNewsroomEvidenceHeldArticleSlug(HELD_PILOT), false);
    },
  );

  console.log(
    `Newsroom evidence-hold preview PASS: default/Production ${defaultState.sitemapPaths.length}/${defaultState.articleSlugs.length}/${defaultState.redirectSources.length}; additive daily publications=${additivePublished.length}; 24 readable noindex holds; frozen legacy redirects/removals unchanged.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
