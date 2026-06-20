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
import { article as art_2026_06_13_palm_jumeirah_handover_2026_two_sold_out_towers_test_the_cre } from "./2026-06-13-palm-jumeirah-handover-2026-two-sold-out-towers-test-the-cre";
import { article as art_2026_06_12_dubai_luxury_off_plan_sales_hit_aed4_96bn_in_may } from "./2026-06-12-dubai-luxury-off-plan-sales-hit-aed4-96bn-in-may";
import { article as art_2026_06_11_emaar_unveils_dh200bn_masterplan_for_150_000_residents_in_du } from "./2026-06-11-emaar-unveils-dh200bn-masterplan-for-150-000-residents-in-du";
import { article as art_2026_06_10_shangri_la_dubai_sells_for_dh1_1bn_as_sheikh_zayed_road_valu } from "./2026-06-10-shangri-la-dubai-sells-for-dh1-1bn-as-sheikh-zayed-road-valu";
import { article as art_2026_06_10_cbd_and_dubai_holding_real_estate_launch_aed_157_9bn_backed_ } from "./2026-06-10-cbd-and-dubai-holding-real-estate-launch-aed-157-9bn-backed-";
import { article as art_2026_06_07_dubai_logs_dhs28_51bn_in_may_property_deals_as_off_plan_abso } from "./2026-06-07-dubai-logs-dhs28-51bn-in-may-property-deals-as-off-plan-abso";
import { article as art_2026_06_06_dubai_s_off_plan_dominance_66_900_sales_in_five_months_as_ma } from "./2026-06-06-dubai-s-off-plan-dominance-66-900-sales-in-five-months-as-ma";
import { article as art_2026_06_05_abu_dhabi_s_rent_freeze_a_structural_intervention_in_the_cap } from "./2026-06-05-abu-dhabi-s-rent-freeze-a-structural-intervention-in-the-cap";
import { article as art_2026_05_31_al_barari_villa_leased_for_aed_14_million_sets_dubai_rental_ } from "./2026-05-31-al-barari-villa-leased-for-aed-14-million-sets-dubai-rental-";
import { article as art_2026_06_17_dir_completes_189_villa_delivery_at_danah_bay_as_rak_absorbs } from "./2026-06-17-dir-completes-189-villa-delivery-at-danah-bay-as-rak-absorbs";
import { article as art_2026_06_17_dir_completes_189_villa_delivery_at_danah_bay_as_rak_gains_i } from "./2026-06-17-dir-completes-189-villa-delivery-at-danah-bay-as-rak-gains-i";
import { article as art_2026_06_18_abu_dhabi_residential_sales_hit_dh38_1bn_in_record_q1_2026 } from "./2026-06-18-abu-dhabi-residential-sales-hit-dh38-1bn-in-record-q1-2026";
import { article as art_2026_06_18_dld_expands_barwa_programme_with_workshops_after_serving_18_ } from "./2026-06-18-dld-expands-barwa-programme-with-workshops-after-serving-18-";
import { article as art_2026_06_20_ahs_properties_acquires_shangri_la_dubai_for_dh1_1bn_eyes_dh } from "./2026-06-20-ahs-properties-acquires-shangri-la-dubai-for-dh1-1bn-eyes-dh";

export const NEWS_ARTICLES: NewsArticle[] = [
  art_2026_06_20_ahs_properties_acquires_shangri_la_dubai_for_dh1_1bn_eyes_dh,
  art_2026_06_18_dld_expands_barwa_programme_with_workshops_after_serving_18_,
  art_2026_06_18_abu_dhabi_residential_sales_hit_dh38_1bn_in_record_q1_2026,
  art_2026_06_17_dir_completes_189_villa_delivery_at_danah_bay_as_rak_gains_i,
  art_2026_06_17_dir_completes_189_villa_delivery_at_danah_bay_as_rak_absorbs,
  art_2026_05_31_al_barari_villa_leased_for_aed_14_million_sets_dubai_rental_,
  art_2026_06_05_abu_dhabi_s_rent_freeze_a_structural_intervention_in_the_cap,
  art_2026_06_06_dubai_s_off_plan_dominance_66_900_sales_in_five_months_as_ma,
  art_2026_06_07_dubai_logs_dhs28_51bn_in_may_property_deals_as_off_plan_abso,
  art_2026_06_10_cbd_and_dubai_holding_real_estate_launch_aed_157_9bn_backed_,
  art_2026_06_10_shangri_la_dubai_sells_for_dh1_1bn_as_sheikh_zayed_road_valu,
  art_2026_06_11_emaar_unveils_dh200bn_masterplan_for_150_000_residents_in_du,
  art_2026_06_12_dubai_luxury_off_plan_sales_hit_aed4_96bn_in_may,
  art_2026_06_13_palm_jumeirah_handover_2026_two_sold_out_towers_test_the_cre,
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
