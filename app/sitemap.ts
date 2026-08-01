import type { MetadataRoute } from "next";
import { SITE } from "@/lib/constants";
import { CLOSING_BELLS } from "@/content/closing-bell";
import { POWER_LISTS } from "@/content/power-list";
import { selectDistinctArticles } from "@/lib/news-editorial";
import {
  PUBLIC_AREA_RECORDS,
  PUBLIC_DEVELOPER_RECORDS,
  PUBLISHED_NEWS_ARTICLES,
} from "@/lib/public-content";
import { getVerticalArticles, VERTICALS } from "@/lib/verticals";

const SITE_UPDATED = new Date("2026-07-25T00:00:00+04:00");

/**
 * Generic sitemap.xml — enumerates every public URL on the subdomain
 * dynamically from the content registries. Distinct from /news-sitemap.xml
 * (Google News spec, only last-48hr articles).
 *
 * Generated from reviewed content registries. Routes with no publishable
 * content remain absent from the sitemap.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const liveNews = selectDistinctArticles(
    PUBLISHED_NEWS_ARTICLES,
    PUBLISHED_NEWS_ARTICLES.length,
  );
  const latestNewsUpdate = new Date(
    Math.max(...liveNews.map((article) => new Date(article.modifiedAt).getTime())),
  );
  const latestAreaUpdate = new Date(
    Math.max(
      ...PUBLIC_AREA_RECORDS.flatMap(({ reports }) =>
        reports.map((article) => new Date(article.modifiedAt).getTime()),
      ),
    ),
  );
  const latestDeveloperTimestamp = Math.max(
    ...PUBLIC_DEVELOPER_RECORDS.flatMap(({ reports }) =>
      reports.map((article) => new Date(article.modifiedAt).getTime()),
    ),
  );
  const latestDeveloperUpdate = Number.isFinite(latestDeveloperTimestamp)
    ? new Date(latestDeveloperTimestamp)
    : SITE_UPDATED;
  const entries: MetadataRoute.Sitemap = [];

  // Static pages
  entries.push(
    { url: SITE.url, lastModified: latestNewsUpdate, changeFrequency: "daily", priority: 1.0 },
    { url: `${SITE.url}/news`, lastModified: latestNewsUpdate, changeFrequency: "hourly", priority: 0.9 },
    { url: `${SITE.url}/areas`, lastModified: latestAreaUpdate, changeFrequency: "weekly", priority: 0.9 },
    { url: `${SITE.url}/map`, lastModified: latestAreaUpdate, changeFrequency: "weekly", priority: 0.75 },
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
    { url: `${SITE.url}/about`, lastModified: SITE_UPDATED, changeFrequency: "monthly", priority: 0.7 },
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
  );

  // Dynamic content — news articles
  for (const a of liveNews) {
    entries.push({
      url: `${SITE.url}/news/${a.slug}`,
      lastModified: new Date(a.modifiedAt),
      changeFrequency: "weekly",
      priority: 0.8,
    });
  }

  // Dynamic content — areas
  for (const { area, reports } of PUBLIC_AREA_RECORDS) {
    entries.push({
      url: `${SITE.url}/areas/${area.slug}`,
      lastModified: new Date(reports[0].modifiedAt),
      changeFrequency: "weekly",
      priority: 0.85,
    });
  }

  // Dynamic content — developers (per-developer landing pages)
  for (const { developer, reports } of PUBLIC_DEVELOPER_RECORDS) {
    const lastModified = new Date(
      Math.max(
        ...reports.map((article) => new Date(article.modifiedAt).getTime()),
      ),
    );
    entries.push({
      url: `${SITE.url}/developer/${developer.slug}`,
      lastModified,
      changeFrequency: "weekly",
      priority: 0.85,
    });
  }

  // Vertical landing pages — only desks with a substantive published archive.
  for (const v of VERTICALS) {
    const reports = getVerticalArticles(v, liveNews);
    if (reports.length === 0) continue;

    entries.push({
      url: `${SITE.url}/v/${v.slug}`,
      lastModified: new Date(reports[0].modifiedAt),
      changeFrequency: "weekly",
      priority: 0.75,
    });
  }

  // Editorial formats stay out of the sitemap until a reviewed edition exists.
  if (CLOSING_BELLS.length > 0) {
    const latestBell = [...CLOSING_BELLS].sort((a, b) =>
      b.publishedAt.localeCompare(a.publishedAt),
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
