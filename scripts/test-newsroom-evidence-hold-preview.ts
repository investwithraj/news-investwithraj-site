import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import sitemap from "../app/sitemap";
import { GET as getFront } from "../app/api/front/route";
import { GET as getNewsSitemap } from "../app/news-sitemap.xml/route";
import { GET as getRss } from "../app/rss.xml/route";
import {
  NEWSROOM_EXACT_REDIRECTS,
  NEWSROOM_HELD_REDIRECTS,
  NEWSROOM_LIFECYCLE_CUTOVER_ENV,
  NEWSROOM_RELEASE_REMOVAL_CANDIDATES,
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
    sitemap: sitemap().length,
    articles: getPublicDiscoveryNewsArticles().length,
    redirects: getReleasedNewsroomRedirects().length,
  };
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
  const additiveCertified = EVIDENCE_CERTIFIED_INDEXABLE_NEWS_ARTICLES.filter(
    (article) => !getNewsroomLifecycle(`/news/${article.slug}`),
  );
  const defaultState = await withMode(
    { evidencePreview: false, lifecycle: false },
    state,
  );
  assert.deepEqual(defaultState, {
    sitemap: 79 + additivePublished.length,
    articles: PUBLISHED_NEWS_ARTICLES.length,
    redirects: 0,
  });
  assert.deepEqual(
    await withMode(
      { vercelEnv: "production", evidencePreview: true, lifecycle: false },
      state,
    ),
    defaultState,
  );
  assert.deepEqual(
    await withMode({ vercelEnv: "preview", evidencePreview: true, lifecycle: false }, state),
    {
      sitemap: 55 + additivePublished.length,
      articles:
        PUBLISHED_NEWS_ARTICLES.length - NEWSROOM_EVIDENCE_HOLD_SLUGS.length,
      redirects: 0,
    },
  );
  assert.deepEqual(
    await withMode({ vercelEnv: "preview", evidencePreview: true, lifecycle: true }, state),
    {
      sitemap: 7 + additiveCertified.length,
      articles: EVIDENCE_CERTIFIED_INDEXABLE_NEWS_ARTICLES.length,
      redirects: 31,
    },
  );
  assert.equal(NEWSROOM_EXACT_REDIRECTS.length, 31);
  assert.equal(Object.keys(NEWSROOM_HELD_REDIRECTS).length, 3);
  assert.equal(NEWSROOM_RELEASE_REMOVAL_CANDIDATES.length, 6);
  assert.match(
    articlePageSource,
    /import \{[\s\S]*isNewsroomEvidenceHeldArticleSlug,[\s\S]*\} from "@\/lib\/public-content"/u,
  );
  assert.equal(
    (articlePageSource.match(/!isNewsroomEvidenceHeldArticleSlug\(/gu) ?? [])
      .length,
    2,
    "Metadata and page schema must share the exact evidence-hold decision.",
  );
  assert.match(articlePageSource, /robots: \{[\s\S]*index: indexEligible,[\s\S]*follow: true/u);
  assert.match(articlePageSource, /alternates: \{[\s\S]*canonical: url/u);
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
  assert.deepEqual(
    defaultDeveloperDirectoryCandidates,
    DEFAULT_DEVELOPER_DIRECTORY_CANDIDATES,
    "The default developer-directory candidate order changed.",
  );
  assert.deepEqual(
    productionDeveloperDirectoryCandidates,
    DEFAULT_DEVELOPER_DIRECTORY_CANDIDATES,
    "Production with the preview flag must preserve developer-directory candidates.",
  );
  assert.deepEqual(
    previewDeveloperDirectoryCandidates,
    [],
    "Evidence preview must emit zero held developer-directory reports.",
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
          PUBLISHED_NEWS_ARTICLES.length -
            NEWSROOM_EVIDENCE_HOLD_SLUGS.length,
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
    `Newsroom evidence-hold preview PASS: default/Production ${defaultState.sitemap}/${defaultState.articles}/0; additive daily publications=${additivePublished.length}; 24 readable noindex holds; redirects/removals unchanged.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
