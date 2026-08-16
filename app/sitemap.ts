import type { MetadataRoute } from "next";

import { SITE } from "@/lib/constants";
import { INDEXABLE_NEWS_ARTICLES } from "@/lib/public-content";

const SITE_UPDATED = new Date("2026-07-25T00:00:00+04:00");

/**
 * Canonical sitemap for the local lifecycle preview.
 *
 * The migration register allows only KEEP and IMPROVE URLs here. NOINDEX,
 * REMOVE, MERGE and REDIRECT sources remain outside every discovery feed.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const latestNewsTimestamp = Math.max(
    ...INDEXABLE_NEWS_ARTICLES.map((article) =>
      new Date(article.modifiedAt).getTime(),
    ),
  );
  const latestNewsUpdate = Number.isFinite(latestNewsTimestamp)
    ? new Date(latestNewsTimestamp)
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

  for (const article of INDEXABLE_NEWS_ARTICLES) {
    entries.push({
      url: `${SITE.url}/news/${article.slug}`,
      lastModified: new Date(article.modifiedAt),
      changeFrequency: "weekly",
      priority: 0.8,
    });
  }

  return entries;
}
