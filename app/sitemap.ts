import type { MetadataRoute } from "next";
import { SITE } from "@/lib/constants";
import { NEWS_ARTICLES } from "@/content/news";
import { AREAS } from "@/content/areas";
import { DEVELOPERS } from "@/lib/developers";
import { VERTICALS } from "@/lib/verticals";

const SITE_UPDATED = new Date("2026-07-25T00:00:00+04:00");

/**
 * Generic sitemap.xml — enumerates every public URL on the subdomain
 * dynamically from the content registries. Distinct from /news-sitemap.xml
 * (Google News spec, only last-48hr articles).
 *
 * Auto-revalidates every hour via Next.js ISR. Content registries grow
 * as the daily cron commits new articles.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const liveNews = NEWS_ARTICLES.filter((article) => article.status !== "research");
  const latestNewsUpdate = new Date(
    Math.max(...liveNews.map((article) => new Date(article.modifiedAt).getTime())),
  );
  const latestAreaUpdate = new Date(
    Math.max(...AREAS.map((area) => new Date(area.modifiedAt).getTime())),
  );
  const entries: MetadataRoute.Sitemap = [];

  // Static pages
  entries.push(
    { url: SITE.url, lastModified: latestNewsUpdate, changeFrequency: "daily", priority: 1.0 },
    { url: `${SITE.url}/news`, lastModified: latestNewsUpdate, changeFrequency: "hourly", priority: 0.9 },
    { url: `${SITE.url}/areas`, lastModified: latestAreaUpdate, changeFrequency: "weekly", priority: 0.9 },
    { url: `${SITE.url}/developers`, lastModified: SITE_UPDATED, changeFrequency: "weekly", priority: 0.9 },
    { url: `${SITE.url}/about`, lastModified: SITE_UPDATED, changeFrequency: "monthly", priority: 0.7 },
    {
      url: `${SITE.url}/about/editorial-standards`,
      lastModified: SITE_UPDATED,
      changeFrequency: "monthly",
      priority: 0.6,
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
  for (const a of AREAS) {
    entries.push({
      url: `${SITE.url}/areas/${a.slug}`,
      lastModified: new Date(a.modifiedAt),
      changeFrequency: "weekly",
      priority: 0.85,
    });
  }

  // Dynamic content — developers (per-developer landing pages)
  for (const d of DEVELOPERS) {
    entries.push({
      url: `${SITE.url}/developer/${d.slug}`,
      lastModified: SITE_UPDATED,
      changeFrequency: "weekly",
      priority: 0.85,
    });
  }

  // Vertical landing pages
  for (const v of VERTICALS) {
    entries.push({
      url: `${SITE.url}/v/${v.slug}`,
      lastModified: SITE_UPDATED,
      changeFrequency: "daily",
      priority: 0.9,
    });
  }

  return entries;
}
