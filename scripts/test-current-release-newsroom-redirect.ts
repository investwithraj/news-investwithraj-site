import assert from "node:assert/strict";

import { GET as getFront } from "@/app/api/front/route";
import { GET as getRss } from "@/app/rss.xml/route";
import sitemap from "@/app/sitemap";
import { SITE } from "@/lib/constants";
import {
  canonicalNewsroomRedirectDestination,
  CURRENT_RELEASE_NEWSROOM_REDIRECT_SOURCE,
  CURRENT_RELEASE_NEWSROOM_REDIRECTS,
  getReleasedNewsroomRedirects,
  isReleasedIndexEligiblePath,
  isRenderableArticleSlug,
  NEWSROOM_EXACT_REDIRECTS,
  NEWSROOM_LIFECYCLE_CUTOVER_ENV,
} from "@/lib/news-lifecycle";
import { projectNewsArchiveItems } from "@/lib/news-archive-projection";
import { getIndexablePublicNewsArticles } from "@/lib/news-discovery";
import nextConfig from "../next.config";

type ConfiguredRedirect = {
  source: string;
  destination: string;
  statusCode?: number;
  permanent?: boolean;
};

const sourceSlug = CURRENT_RELEASE_NEWSROOM_REDIRECT_SOURCE.slice(
  "/news/".length,
);

async function main() {
  const originalCutover = process.env[NEWSROOM_LIFECYCLE_CUTOVER_ENV];

  try {
    process.env[NEWSROOM_LIFECYCLE_CUTOVER_ENV] = "0";

    assert.deepEqual(
      getReleasedNewsroomRedirects(),
      CURRENT_RELEASE_NEWSROOM_REDIRECTS,
    );
    assert.equal(CURRENT_RELEASE_NEWSROOM_REDIRECTS.length, 1);
    assert.equal(isRenderableArticleSlug(sourceSlug), false);
    assert.equal(
      isReleasedIndexEligiblePath(CURRENT_RELEASE_NEWSROOM_REDIRECT_SOURCE),
      false,
    );

    const indexableArticles = getIndexablePublicNewsArticles();
    assert.ok(
      indexableArticles.every((article) => article.slug !== sourceSlug),
      "The released redirect source must leave the central discovery set.",
    );
    assert.ok(
      projectNewsArchiveItems(indexableArticles).every(
        (article) => article.slug !== sourceSlug,
      ),
      "The released redirect source must leave the archive projection.",
    );
    assert.ok(
      sitemap().every(
        (entry) =>
          new URL(entry.url).pathname !==
          CURRENT_RELEASE_NEWSROOM_REDIRECT_SOURCE,
      ),
      "The released redirect source must leave the general sitemap.",
    );

    const rss = await getRss().text();
    assert.ok(
      !rss.includes(`${SITE.url}${CURRENT_RELEASE_NEWSROOM_REDIRECT_SOURCE}`),
      "The released redirect source must leave RSS.",
    );

    const frontResponse = await getFront();
    const front = (await frontResponse.json()) as {
      items: Array<{ slug: string }>;
    };
    assert.ok(
      front.items.every((article) => article.slug !== sourceSlug),
      "The released redirect source must leave the front API.",
    );

    const redirects = await configuredRedirects();
    const configuredLifecycleRedirects = redirects.filter(({ source }) =>
      NEWSROOM_EXACT_REDIRECTS.some(
        (lifecycleRedirect) => lifecycleRedirect.source === source,
      ),
    );
    const expectedDestination = canonicalNewsroomRedirectDestination(
      CURRENT_RELEASE_NEWSROOM_REDIRECTS[0].destination,
    );
    assert.deepEqual(configuredLifecycleRedirects, [
      {
        source: CURRENT_RELEASE_NEWSROOM_REDIRECT_SOURCE,
        destination: expectedDestination,
        statusCode: 301,
      },
    ]);
    assert.equal(new URL(expectedDestination).origin, SITE.url);
    assert.ok(
      !NEWSROOM_EXACT_REDIRECTS.some(
        ({ source }) => source === new URL(expectedDestination).pathname,
      ),
      "The current release redirect must reach its final canonical URL in one hop.",
    );

    const stillGatedRedirect = NEWSROOM_EXACT_REDIRECTS.find(
      ({ source }) => source !== CURRENT_RELEASE_NEWSROOM_REDIRECT_SOURCE,
    );
    assert.ok(stillGatedRedirect);
    assert.ok(
      !configuredLifecycleRedirects.some(
        ({ source }) => source === stillGatedRedirect.source,
      ),
      "Every other lifecycle redirect must remain gated.",
    );

    process.env[NEWSROOM_LIFECYCLE_CUTOVER_ENV] = "1";
    assert.equal(
      getReleasedNewsroomRedirects().length,
      NEWSROOM_EXACT_REDIRECTS.length,
      "The full-cutover redirect count must remain stable.",
    );
    assert.equal(NEWSROOM_EXACT_REDIRECTS.length, 31);

    console.log(
      "Current newsroom release PASS: one Flexi Rent 301 is live in configuration, its source is removed centrally from public discovery, and the other 30 redirects remain gated.",
    );
  } finally {
    if (originalCutover === undefined) {
      delete process.env[NEWSROOM_LIFECYCLE_CUTOVER_ENV];
    } else {
      process.env[NEWSROOM_LIFECYCLE_CUTOVER_ENV] = originalCutover;
    }
  }
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
