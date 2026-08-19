import type { MetadataRoute } from "next";

import { CLOSING_BELLS } from "@/content/closing-bell";
import { POWER_LISTS } from "@/content/power-list";
import { SITE } from "@/lib/constants";
import { selectDistinctArticles } from "@/lib/news-editorial";
import { isNewsroomLifecycleCutoverEnabled } from "@/lib/news-lifecycle";
import {
  getLifecycleProjectedNewsArticles,
  isNewsroomEvidenceHeldArticleSlug,
  isNewsroomEvidenceHoldPreviewEnabled,
  PUBLIC_AREA_RECORDS,
  PUBLIC_DEVELOPER_RECORDS,
} from "@/lib/public-content";
import { getVerticalArticles, VERTICALS } from "@/lib/verticals";

const SITE_UPDATED = new Date("2026-07-25T00:00:00+04:00");

/**
 * The lifecycle release is atomic at the discovery boundary too. Until the
 * single cutover flag is enabled, this reproduces the complete pre-cutover
 * sitemap (including area, developer, terminal and vertical routes). After
 * cutover, only the matrix-approved KEEP + IMPROVE URLs are emitted.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const projection = isNewsroomLifecycleCutoverEnabled()
    ? releasedLifecycleSitemap()
    : currentPublicSitemap();
  return isNewsroomEvidenceHoldPreviewEnabled()
    ? projection.filter((entry) => {
        const pathname = new URL(entry.url).pathname;
        return (
          !pathname.startsWith("/news/") ||
          !isNewsroomEvidenceHeldArticleSlug(pathname.slice("/news/".length))
        );
      })
    : projection;
}

function releasedLifecycleSitemap(): MetadataRoute.Sitemap {
  const publicArticles = getLifecycleProjectedNewsArticles();
  const latestNewsUpdate = latestArticleUpdate(publicArticles);
  const entries: MetadataRoute.Sitemap = [
    {
      url: SITE.url,
      lastModified: latestNewsUpdate,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${SITE.url}/news`,
      lastModified: latestNewsUpdate,
      changeFrequency: "hourly",
      priority: 0.9,
    },
    {
      url: `${SITE.url}/about`,
      lastModified: SITE_UPDATED,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${SITE.url}/about/editorial-standards`,
      lastModified: SITE_UPDATED,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${SITE.url}/legal/privacy`,
      lastModified: SITE_UPDATED,
      changeFrequency: "monthly",
      priority: 0.4,
    },
  ];

  appendArticleEntries(entries, publicArticles);
  return entries;
}

/** Exact pre-lifecycle public sitemap, retained while cutover is off. */
function currentPublicSitemap(): MetadataRoute.Sitemap {
  const allPublicArticles = getLifecycleProjectedNewsArticles();
  const liveNews = selectDistinctArticles(
    allPublicArticles,
    allPublicArticles.length,
  );
  const latestNewsUpdate = latestArticleUpdate(liveNews);
  const latestAreaUpdate = latestArticleUpdate(
    PUBLIC_AREA_RECORDS.flatMap(({ reports }) => reports),
  );
  const developerTimestamps = PUBLIC_DEVELOPER_RECORDS.flatMap(({ reports }) =>
    reports.map((article) => new Date(article.modifiedAt).getTime()),
  );
  const latestDeveloperTimestamp = Math.max(...developerTimestamps);
  const latestDeveloperUpdate = Number.isFinite(latestDeveloperTimestamp)
    ? new Date(latestDeveloperTimestamp)
    : SITE_UPDATED;

  const entries: MetadataRoute.Sitemap = [
    {
      url: SITE.url,
      lastModified: latestNewsUpdate,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${SITE.url}/news`,
      lastModified: latestNewsUpdate,
      changeFrequency: "hourly",
      priority: 0.9,
    },
    {
      url: `${SITE.url}/areas`,
      lastModified: latestAreaUpdate,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${SITE.url}/map`,
      lastModified: latestAreaUpdate,
      changeFrequency: "weekly",
      priority: 0.75,
    },
    {
      url: `${SITE.url}/terminal`,
      lastModified: latestNewsUpdate,
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: `${SITE.url}/developers`,
      lastModified: latestDeveloperUpdate,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${SITE.url}/about`,
      lastModified: SITE_UPDATED,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${SITE.url}/about/editorial-standards`,
      lastModified: SITE_UPDATED,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${SITE.url}/legal/privacy`,
      lastModified: SITE_UPDATED,
      changeFrequency: "monthly",
      priority: 0.4,
    },
  ];

  appendArticleEntries(entries, liveNews);

  for (const { area, reports } of PUBLIC_AREA_RECORDS) {
    entries.push({
      url: `${SITE.url}/areas/${area.slug}`,
      lastModified: new Date(reports[0].modifiedAt),
      changeFrequency: "weekly",
      priority: 0.85,
    });
  }

  for (const { developer, reports } of PUBLIC_DEVELOPER_RECORDS) {
    entries.push({
      url: `${SITE.url}/developer/${developer.slug}`,
      lastModified: latestArticleUpdate(reports),
      changeFrequency: "weekly",
      priority: 0.85,
    });
  }

  for (const vertical of VERTICALS) {
    const reports = getVerticalArticles(vertical, liveNews);
    if (reports.length === 0) continue;
    entries.push({
      url: `${SITE.url}/v/${vertical.slug}`,
      lastModified: new Date(reports[0].modifiedAt),
      changeFrequency: "weekly",
      priority: 0.75,
    });
  }

  if (CLOSING_BELLS.length > 0) {
    const latestBell = [...CLOSING_BELLS].sort((left, right) =>
      right.publishedAt.localeCompare(left.publishedAt),
    )[0];
    entries.push({
      url: `${SITE.url}/closing-bell`,
      lastModified: new Date(latestBell.publishedAt),
      changeFrequency: "weekly",
      priority: 0.65,
    });
  }

  for (const edition of POWER_LISTS) {
    if (edition.entries.length === 0) continue;
    entries.push({
      url: `${SITE.url}/power-list/${edition.year}`,
      lastModified: new Date(edition.modifiedAt ?? edition.publishedAt),
      changeFrequency: "yearly",
      priority: 0.6,
    });
  }

  return entries;
}

type SitemapArticle = Readonly<{
  slug: string;
  modifiedAt: string;
}>;

function appendArticleEntries(
  entries: MetadataRoute.Sitemap,
  articles: readonly SitemapArticle[],
) {
  for (const article of articles) {
    entries.push({
      url: `${SITE.url}/news/${article.slug}`,
      lastModified: new Date(article.modifiedAt),
      changeFrequency: "weekly",
      priority: 0.8,
    });
  }
}

function latestArticleUpdate(articles: readonly SitemapArticle[]): Date {
  const latestTimestamp = Math.max(
    ...articles.map((article) => new Date(article.modifiedAt).getTime()),
  );
  return Number.isFinite(latestTimestamp)
    ? new Date(latestTimestamp)
    : SITE_UPDATED;
}
