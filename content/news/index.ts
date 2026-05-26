// Central registry of all news articles. Populated by the daily content
// pipeline (Block 2.3). Empty Day-1 — first article ships when the
// `schedule` skill cron fires + a draft passes voice + citation gates.
//
// To add an article manually (e.g. for QA / dry-run testing):
//   1. Create content/news/YYYY-MM-DD-slug.ts exporting `const article: NewsArticle`
//   2. Import it here + push into NEWS_ARTICLES
//   3. Vercel auto-deploys on push, /news/[slug] route generates

import type { NewsArticle } from "./types";
export type { NewsArticle } from "./types";
export {
  sortNewsArticles,
  groupByCategory,
  type NewsCategory,
  type Citation,
  type HeroImage,
  type Cta,
  type DistributionConfig,
  type FaqItem,
  type ViewFrom,
  type BrokerTake,
  type SemaformSections,
} from "./types";

export const NEWS_ARTICLES: NewsArticle[] = [];

/** Latest N news articles, most recent first. */
export function getLatestNews(limit = 10): NewsArticle[] {
  return [...NEWS_ARTICLES]
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    .slice(0, limit);
}

/** Get a single article by slug, or null if not found. */
export function getNewsBySlug(slug: string): NewsArticle | null {
  return NEWS_ARTICLES.find((a) => a.slug === slug) ?? null;
}

/** All slugs for generateStaticParams() in /news/[slug]/page.tsx. */
export function getAllNewsSlugs(): string[] {
  return NEWS_ARTICLES.map((a) => a.slug);
}

/** Articles published in the last 48 hours — used by news-sitemap.xml
 *  per Google News spec (only show recent articles). */
export function getNewsForGoogleNewsSitemap(): NewsArticle[] {
  const cutoffMs = Date.now() - 48 * 60 * 60 * 1000;
  return NEWS_ARTICLES.filter((a) => {
    const t = new Date(a.publishedAt).getTime();
    return t >= cutoffMs;
  });
}
