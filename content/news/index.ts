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

import { article as dld21bWeek } from "./2026-05-26-dld-21b-week";
import { article as modonHudayriyatGolfEstate } from "./2026-05-26-modon-hudayriyat-golf-estate";
import { article as goldenVisaMortgageFlex } from "./2026-05-26-golden-visa-mortgage-flex";
import { article as art_2026_05_30_al_barari_villa_lease_resets_dubai_ultra_prime_rental_ceilin } from "./2026-05-30-al-barari-villa-lease-resets-dubai-ultra-prime-rental-ceilin";
import { article as art_2026_05_30_dubai_s_19_6m_visitors_drive_luxury_property_surge_as_touris } from "./2026-05-30-dubai-s-19-6m-visitors-drive-luxury-property-surge-as-touris";
import { article as art_2026_06_14_branded_residences_command_64_premium_as_dubai_buyers_chase_ } from "./2026-06-14-branded-residences-command-64-premium-as-dubai-buyers-chase-";

export const NEWS_ARTICLES: NewsArticle[] = [
  art_2026_06_14_branded_residences_command_64_premium_as_dubai_buyers_chase_,
  art_2026_05_30_dubai_s_19_6m_visitors_drive_luxury_property_surge_as_touris,
  art_2026_05_30_al_barari_villa_lease_resets_dubai_ultra_prime_rental_ceilin,
  dld21bWeek,
  modonHudayriyatGolfEstate,
  goldenVisaMortgageFlex,
];

/** True if the article has shipped (live or status omitted). False for
 *  in-research stubs that keep slugs warm but should not surface in feeds. */
function isLive(a: NewsArticle): boolean {
  return a.status !== "research";
}

/** Latest N live news articles, most recent first. In-research entries
 *  are filtered out — they keep their slug but don't appear in feeds. */
export function getLatestNews(limit = 10): NewsArticle[] {
  return [...NEWS_ARTICLES]
    .filter(isLive)
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    .slice(0, limit);
}

/** Get a single article by slug, or null if not found. Resolves
 *  in-research stubs too (slug stays warm). */
export function getNewsBySlug(slug: string): NewsArticle | null {
  return NEWS_ARTICLES.find((a) => a.slug === slug) ?? null;
}

/** All slugs for generateStaticParams() in /news/[slug]/page.tsx. Includes
 *  in-research stubs so the routes still pre-render. */
export function getAllNewsSlugs(): string[] {
  return NEWS_ARTICLES.map((a) => a.slug);
}

/** Articles published in the last 48 hours — used by news-sitemap.xml
 *  per Google News spec. Excludes in-research stubs (must not be indexed
 *  as fresh news content). */
export function getNewsForGoogleNewsSitemap(): NewsArticle[] {
  const cutoffMs = Date.now() - 48 * 60 * 60 * 1000;
  return NEWS_ARTICLES.filter(isLive).filter((a) => {
    const t = new Date(a.publishedAt).getTime();
    return t >= cutoffMs;
  });
}
