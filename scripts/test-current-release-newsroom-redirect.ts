import assert from "node:assert/strict";

import { NextRequest } from "next/server";

import { POST as postDistribute } from "@/app/api/distribute/route";
import { GET as getFront } from "@/app/api/front/route";
import { GET as getLlms } from "@/app/llms.txt/route";
import { GET as getNewsSitemap } from "@/app/news-sitemap.xml/route";
import { GET as getRss } from "@/app/rss.xml/route";
import sitemap from "@/app/sitemap";
import { AREAS } from "@/content/areas";
import { NEWS_ARTICLES } from "@/content/news";
import { SITE } from "@/lib/constants";
import { DEVELOPERS } from "@/lib/developers";
import {
  articleMentionsArea,
  articleMentionsDeveloper,
} from "@/lib/news-editorial";
import {
  canonicalNewsroomRedirectDestination,
  CURRENT_RELEASE_ALDAR_REDIRECT_DESTINATION,
  CURRENT_RELEASE_ALDAR_REDIRECT_SOURCE,
  CURRENT_RELEASE_NEWSROOM_REDIRECT_SOURCE,
  CURRENT_RELEASE_NEWSROOM_REDIRECT_SOURCES,
  CURRENT_RELEASE_NEWSROOM_REDIRECTS,
  FULL_RELEASE_NEWSROOM_REDIRECTS,
  getReleasedNewsroomRedirects,
  isReleasedIndexEligiblePath,
  isRenderableArticleSlug,
  isRenderableLifecyclePath,
  NEWSROOM_EXACT_REDIRECTS,
  NEWSROOM_LIFECYCLE_CUTOVER_ENV,
} from "@/lib/news-lifecycle";
import { projectNewsArchiveItems } from "@/lib/news-archive-projection";
import { getIndexablePublicNewsArticles } from "@/lib/news-discovery";
import {
  getPublicDiscoveryNewsArticles,
  PUBLIC_AREA_RECORDS,
  PUBLIC_DEVELOPER_RECORDS,
} from "@/lib/public-content";
import nextConfig from "../next.config";

type ConfiguredRedirect = {
  source: string;
  destination: string;
  statusCode?: number;
  permanent?: boolean;
};

const FLEXI_DESTINATION =
  "/news/2026-06-23-dubai-launches-flexi-rent-12-landlords-offer-monthly-instalm";
const POST_SECRET = "current-release-redirect-test-secret-32-bytes";

const sourceSlugs = CURRENT_RELEASE_NEWSROOM_REDIRECT_SOURCES.map((source) =>
  source.slice("/news/".length),
);
const destinationPaths = [
  FLEXI_DESTINATION,
  CURRENT_RELEASE_ALDAR_REDIRECT_DESTINATION,
] as const;
const destinationSlugs = destinationPaths.map((destination) =>
  destination.slice("/news/".length),
);

async function main() {
  const originalCutover = process.env[NEWSROOM_LIFECYCLE_CUTOVER_ENV];
  const originalPostSecret = process.env.POST_PUBLISH_SECRET;

  try {
    process.env[NEWSROOM_LIFECYCLE_CUTOVER_ENV] = "0";

    assert.deepEqual(CURRENT_RELEASE_NEWSROOM_REDIRECTS, [
      {
        source: CURRENT_RELEASE_NEWSROOM_REDIRECT_SOURCE,
        destination: FLEXI_DESTINATION,
        statusCode: 301,
      },
      {
        source: CURRENT_RELEASE_ALDAR_REDIRECT_SOURCE,
        destination: CURRENT_RELEASE_ALDAR_REDIRECT_DESTINATION,
        statusCode: 301,
      },
    ]);
    assert.deepEqual(
      getReleasedNewsroomRedirects(),
      CURRENT_RELEASE_NEWSROOM_REDIRECTS,
    );
    assert.equal(CURRENT_RELEASE_NEWSROOM_REDIRECTS.length, 2);
    assert.equal(NEWSROOM_EXACT_REDIRECTS.length, 31);
    assert.equal(FULL_RELEASE_NEWSROOM_REDIRECTS.length, 32);

    const indexableArticles = getIndexablePublicNewsArticles();
    const indexableSlugs = indexableArticles.map((article) => article.slug);
    const archiveSlugs = projectNewsArchiveItems(indexableArticles).map(
      (article) => article.slug,
    );
    for (const sourceSlug of sourceSlugs) {
      const sourcePath = `/news/${sourceSlug}`;
      assert.equal(isRenderableArticleSlug(sourceSlug), false);
      assert.equal(isReleasedIndexEligiblePath(sourcePath), false);
      assert.ok(!indexableSlugs.includes(sourceSlug));
      assert.ok(!archiveSlugs.includes(sourceSlug));
    }
    for (const destinationSlug of destinationSlugs) {
      assert.ok(
        indexableSlugs.includes(destinationSlug),
        `${destinationSlug} must remain the indexable canonical survivor.`,
      );
      assert.ok(archiveSlugs.includes(destinationSlug));
    }

    const sitemapPaths = sitemap().map((entry) => new URL(entry.url).pathname);
    for (const source of CURRENT_RELEASE_NEWSROOM_REDIRECT_SOURCES) {
      assert.ok(!sitemapPaths.includes(source));
    }
    for (const destination of destinationPaths) {
      assert.ok(sitemapPaths.includes(destination));
    }

    const aldarTarget = NEWS_ARTICLES.find(
      (article) => article.slug === destinationSlugs[1],
    );
    const aldarSource = NEWS_ARTICLES.find(
      (article) => article.slug === sourceSlugs[1],
    );
    assert.ok(aldarSource, "The retired Aldar source record must be preserved.");
    assert.ok(aldarTarget, "The corrected Aldar canonical record is missing.");
    assert.deepEqual(
      aldarSource.citations.map(({ url }) => url).sort(),
      aldarTarget.citations.map(({ url }) => url).sort(),
      "The Aldar retirement must remain bound to the audited identical source set.",
    );

    const overviewArticles = getPublicDiscoveryNewsArticles();
    const expectedAreaOverview = AREAS.map((area) => ({
      slug: area.slug,
      reports: overviewArticles
        .filter((article) => articleMentionsArea(article, area))
        .map(overviewReportMetadata),
    })).filter(
      ({ slug, reports }) =>
        reports.length > 0 && isRenderableLifecyclePath(`/areas/${slug}`),
    );
    const expectedDeveloperOverview = DEVELOPERS.map((developer) => ({
      slug: developer.slug,
      reports: overviewArticles
        .filter((article) => articleMentionsDeveloper(article, developer))
        .map(overviewReportMetadata),
    })).filter(
      ({ slug, reports }) =>
        reports.length > 0 && isRenderableLifecyclePath(`/developer/${slug}`),
    );
    assert.deepEqual(
      PUBLIC_AREA_RECORDS.map(({ area, reports }) => ({
        slug: area.slug,
        reports: reports.map(overviewReportMetadata),
      })),
      expectedAreaOverview,
      "Area overview counts and timestamps must derive from release-aware discovery.",
    );
    assert.deepEqual(
      PUBLIC_DEVELOPER_RECORDS.map(({ developer, reports }) => ({
        slug: developer.slug,
        reports: reports.map(overviewReportMetadata),
      })),
      expectedDeveloperOverview,
      "Developer overview counts and timestamps must derive from release-aware discovery.",
    );
    const overviewReportSlugs = new Set(
      [...PUBLIC_AREA_RECORDS, ...PUBLIC_DEVELOPER_RECORDS].flatMap(
        ({ reports }) => reports.map((article) => article.slug),
      ),
    );
    assert.ok(
      sourceSlugs.every((slug) => !overviewReportSlugs.has(slug)),
      "Released Flexi/Aldar redirect sources must not inflate overview metadata.",
    );
    const aldarOverview = PUBLIC_DEVELOPER_RECORDS.find(
      ({ developer }) => developer.slug === "aldar",
    );
    assert.ok(aldarOverview, "The Aldar developer overview is missing.");
    assert.ok(
      aldarOverview.reports.some(
        (article) => article.slug === destinationSlugs[1],
      ),
      "The corrected Aldar canonical must remain in developer overview metadata.",
    );
    assert.equal(
      aldarOverview.reports[0]?.slug,
      destinationSlugs[1],
      "The retired Aldar duplicate must not replace the canonical as the latest developer report.",
    );

    const originalNow = Date.now;
    Date.now = () =>
      new Date(aldarTarget.publishedAt).getTime() + 24 * 60 * 60 * 1_000;
    try {
      const newsSitemap = await getNewsSitemap().text();
      assert.ok(!newsSitemap.includes(CURRENT_RELEASE_ALDAR_REDIRECT_SOURCE));
      assert.ok(
        newsSitemap.includes(CURRENT_RELEASE_ALDAR_REDIRECT_DESTINATION),
      );
    } finally {
      Date.now = originalNow;
    }

    const rss = await getRss().text();
    const llms = await getLlms().text();
    for (const source of CURRENT_RELEASE_NEWSROOM_REDIRECT_SOURCES) {
      assert.ok(!rss.includes(`${SITE.url}${source}`));
      assert.ok(!llms.includes(`${SITE.url}${source}`));
    }
    assert.ok(
      rss.includes(`${SITE.url}${CURRENT_RELEASE_ALDAR_REDIRECT_DESTINATION}`),
    );
    assert.ok(
      llms.includes(`${SITE.url}${CURRENT_RELEASE_ALDAR_REDIRECT_DESTINATION}`),
    );

    const frontResponse = await getFront();
    const front = (await frontResponse.json()) as {
      items: Array<{ slug: string }>;
    };
    assert.ok(front.items.every(({ slug }) => !sourceSlugs.includes(slug)));
    assert.ok(front.items.some(({ slug }) => slug === destinationSlugs[1]));

    process.env.POST_PUBLISH_SECRET = POST_SECRET;
    const retiredDistribution = await postDistribute(
      distributionRequest(sourceSlugs[1]),
    );
    assert.equal(retiredDistribution.status, 400);
    assert.deepEqual(
      ((await retiredDistribution.json()) as { missingSlugs: string[] })
        .missingSlugs,
      [sourceSlugs[1]],
    );
    const canonicalDistribution = await postDistribute(
      distributionRequest(destinationSlugs[1]),
    );
    assert.equal(canonicalDistribution.status, 200);
    const canonicalDistributionBody = (await canonicalDistribution.json()) as {
      dryRun: boolean;
      attempted: boolean;
      previews: Array<{ articleSlug: string }>;
    };
    assert.equal(canonicalDistributionBody.dryRun, true);
    assert.equal(canonicalDistributionBody.attempted, false);
    assert.deepEqual(
      canonicalDistributionBody.previews.map(({ articleSlug }) => articleSlug),
      [destinationSlugs[1]],
    );

    const redirects = await configuredRedirects();
    const configuredCurrentRedirects = redirects.filter(({ source }) =>
      CURRENT_RELEASE_NEWSROOM_REDIRECT_SOURCES.includes(
        source as (typeof CURRENT_RELEASE_NEWSROOM_REDIRECT_SOURCES)[number],
      ),
    );
    assert.deepEqual(
      configuredCurrentRedirects,
      CURRENT_RELEASE_NEWSROOM_REDIRECTS.map(
        ({ source, destination, statusCode }) => ({
          source,
          destination: canonicalNewsroomRedirectDestination(destination),
          statusCode,
        }),
      ),
    );
    for (const redirect of configuredCurrentRedirects) {
      const destination = new URL(redirect.destination);
      assert.equal(destination.origin, SITE.url);
      assert.ok(
        !FULL_RELEASE_NEWSROOM_REDIRECTS.some(
          ({ source }) => source === destination.pathname,
        ),
        `${redirect.source} must reach its final canonical URL in one hop.`,
      );
    }

    const stillGatedLegacyRedirects = NEWSROOM_EXACT_REDIRECTS.filter(
      ({ source }) => source !== CURRENT_RELEASE_NEWSROOM_REDIRECT_SOURCE,
    );
    assert.equal(stillGatedLegacyRedirects.length, 30);
    assert.ok(
      stillGatedLegacyRedirects.every(
        ({ source }) =>
          !redirects.some((redirect) => redirect.source === source),
      ),
      "Every other legacy lifecycle redirect must remain gated.",
    );

    process.env[NEWSROOM_LIFECYCLE_CUTOVER_ENV] = "1";
    assert.equal(getReleasedNewsroomRedirects().length, 32);
    assert.equal(
      (await configuredRedirects()).filter(({ source }) =>
        FULL_RELEASE_NEWSROOM_REDIRECTS.some(
          (redirect) => redirect.source === source,
        ),
      ).length,
      32,
    );

    console.log(
      "Current newsroom release PASS: two reviewed duplicate 301s are live in configuration, both sources are absent from discovery/distribution, both canonical survivors remain indexable, 31 legacy redirects stay frozen and the other 30 remain gated by default.",
    );
  } finally {
    if (originalCutover === undefined) {
      delete process.env[NEWSROOM_LIFECYCLE_CUTOVER_ENV];
    } else {
      process.env[NEWSROOM_LIFECYCLE_CUTOVER_ENV] = originalCutover;
    }
    if (originalPostSecret === undefined) {
      delete process.env.POST_PUBLISH_SECRET;
    } else {
      process.env.POST_PUBLISH_SECRET = originalPostSecret;
    }
  }
}

function overviewReportMetadata(article: {
  slug: string;
  publishedAt: string;
  modifiedAt?: string;
}) {
  return {
    slug: article.slug,
    publishedAt: article.publishedAt,
    modifiedAt: article.modifiedAt,
  };
}

function distributionRequest(slug: string): NextRequest {
  return new NextRequest(`${SITE.url}/api/distribute`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-post-publish-secret": POST_SECRET,
    },
    body: JSON.stringify({
      slugs: [slug],
      channels: ["instagram-feed"],
      confirm: false,
    }),
  });
}

async function configuredRedirects(): Promise<ConfiguredRedirect[]> {
  if (typeof nextConfig.redirects !== "function") {
    throw new Error("next.config.ts has no redirects function.");
  }
  return (await nextConfig.redirects()) as ConfiguredRedirect[];
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
