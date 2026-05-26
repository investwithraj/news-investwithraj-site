import type { MetadataRoute } from "next";
import { SITE } from "@/lib/constants";
import { NEWS_ARTICLES } from "@/content/news";
import { INSIGHT_ARTICLES } from "@/content/insights";
import { AREAS } from "@/content/areas";

/**
 * Generic sitemap.xml — enumerates every public URL on the subdomain
 * dynamically from the content registries. Distinct from /news-sitemap.xml
 * (Google News spec, only last-48hr articles).
 *
 * Auto-revalidates every hour via Next.js ISR. Content registries grow
 * as the daily cron commits new articles.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const entries: MetadataRoute.Sitemap = [];

  // Static pages
  entries.push(
    { url: SITE.url, lastModified: now, changeFrequency: "daily", priority: 1.0 },
    { url: `${SITE.url}/news`, lastModified: now, changeFrequency: "hourly", priority: 0.9 },
    { url: `${SITE.url}/insights`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${SITE.url}/areas`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${SITE.url}/about`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    {
      url: `${SITE.url}/about/editorial-standards`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${SITE.url}/legal/privacy`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  );

  // Dynamic content — news articles
  for (const a of NEWS_ARTICLES) {
    entries.push({
      url: `${SITE.url}/news/${a.slug}`,
      lastModified: new Date(a.modifiedAt),
      changeFrequency: "weekly",
      priority: 0.8,
    });
  }

  // Dynamic content — insights
  for (const a of INSIGHT_ARTICLES) {
    entries.push({
      url: `${SITE.url}/insights/${a.slug}`,
      lastModified: new Date(a.modifiedAt),
      changeFrequency: "monthly",
      priority: 0.85,
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

  return entries;
}
