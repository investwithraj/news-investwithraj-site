import { AREAS } from "@/content/areas";
import { NEWS_ARTICLES } from "@/content/news";
import type { NewsArticle } from "@/content/news/types";
import {
  advisoryLinkForDeveloper,
  advisoryLinksForArea,
  type AdvisoryLink,
} from "@/lib/advisory-relations";
import { DEVELOPERS } from "@/lib/developers";

export type ArticleRelationRecord = Readonly<{
  articleSlug: string;
  areaSlugs: readonly string[];
  developerSlugs: readonly string[];
}>;

export type ResolvedArticleArea = Readonly<{
  slug: string;
  name: string;
  advisoryLinks: readonly AdvisoryLink[];
}>;

export type ResolvedArticleDeveloper = Readonly<{
  slug: string;
  name: string;
  advisoryLink: AdvisoryLink;
}>;

/**
 * Editorially reviewed, central-subject relations for the current public
 * corpus. Empty arrays are affirmative classifications, not missing data.
 *
 * This registry must never be generated from article body text. A new public
 * article blocks validation until it receives exactly one explicit record.
 */
export const ARTICLE_RELATION_RECORDS = [
  {
    articleSlug:
      "2026-08-20-82-of-uae-residents-plan-waterfront-move-as-values-surge",
    areaSlugs: [],
    developerSlugs: [],
  },
  {
    articleSlug:
      "2026-08-13-dubai-luxury-segment-posts-aed-87-71bn-as-conviction",
    areaSlugs: [],
    developerSlugs: [],
  },
  {
    articleSlug:
      "2026-08-13-omniyat-acquires-36-600-sqm-marjan-beach-plot-in-first-rak",
    areaSlugs: ["al-marjan-island"],
    developerSlugs: [],
  },
  {
    articleSlug:
      "2026-07-28-burtville-launches-405-unit-bab-al-qasr-garden-residences-65",
    areaSlugs: [],
    developerSlugs: [],
  },
  {
    articleSlug:
      "2026-07-26-off-plan-sales-capture-71-of-dubai-transactions-as-h1-2026-h",
    areaSlugs: [],
    developerSlugs: [],
  },
  {
    articleSlug:
      "2026-07-25-dubai-logs-aed-419-94bn-in-h1-transactions-as-weekly-volumes",
    areaSlugs: [],
    developerSlugs: [],
  },
  {
    articleSlug:
      "2026-07-23-aldar-activates-aed-100-bn-marsa-al-saadiyat-saadiyat-island",
    areaSlugs: ["saadiyat-island"],
    developerSlugs: ["aldar"],
  },
  {
    articleSlug:
      "2026-07-22-dubai-office-rents-stabilise-at-aed-238-sqft-as-grade-a-scar",
    areaSlugs: [],
    developerSlugs: [],
  },
  {
    articleSlug:
      "2026-07-21-ethiopia-sets-10m-investment-bar-for-golden-visa-18-uae-prop",
    areaSlugs: [],
    developerSlugs: [],
  },
  {
    articleSlug:
      "2026-07-19-aed-318-billion-q1-transactions-reveal-diverging-investor-ma",
    areaSlugs: [],
    developerSlugs: [],
  },
  {
    articleSlug:
      "2026-07-14-dubai-property-prices-fall-1-24-in-june-as-yields-hold-at-6-",
    areaSlugs: [],
    developerSlugs: [],
  },
  {
    articleSlug:
      "2026-07-12-kuwait-property-deals-fall-13-as-land-fees-and-war-chill-h1-",
    areaSlugs: [],
    developerSlugs: [],
  },
  {
    articleSlug:
      "2026-07-10-aldar-unveils-dh6bn-yas-point-1-600-residences-anchor-northe",
    areaSlugs: ["yas-island"],
    developerSlugs: ["aldar"],
  },
  {
    articleSlug:
      "2026-07-10-dubai-retail-sales-surge-171-to-aed-2-1bn-as-off-plan-mandat",
    areaSlugs: [],
    developerSlugs: [],
  },
  {
    articleSlug:
      "2026-07-09-modon-and-adib-launch-75-off-plan-financing-for-abu-dhabi-co",
    areaSlugs: [],
    developerSlugs: ["modon"],
  },
  {
    articleSlug:
      "2026-07-08-dubai-ultra-prime-sales-hit-5-1bn-as-296-homes-above-10m-tra",
    areaSlugs: [],
    developerSlugs: [],
  },
  {
    articleSlug:
      "2026-07-06-bugatti-residences-closes-aed-270mn-in-june-penthouse-sales",
    areaSlugs: [],
    developerSlugs: [],
  },
  {
    articleSlug:
      "2026-07-02-dubai-real-estate-sets-historic-high-water-mark-with-aed-252",
    areaSlugs: [],
    developerSlugs: [],
  },
  {
    articleSlug:
      "2026-07-01-uk-buyers-lead-dubai-property-demand-but-banks-tighten-the-g",
    areaSlugs: [],
    developerSlugs: [],
  },
  {
    articleSlug:
      "2026-06-29-dar-global-launches-19-fendi-casa-villas-at-oman-s-aida-clif",
    areaSlugs: [],
    developerSlugs: [],
  },
  {
    articleSlug:
      "2026-06-28-dubai-mandates-monthly-rent-option-across-12-landlords-in-fl",
    areaSlugs: [],
    developerSlugs: [],
  },
  {
    articleSlug:
      "2026-06-24-oman-tenders-1-035bn-solar-mandate-as-vision-2040-absorbs-1-",
    areaSlugs: [],
    developerSlugs: [],
  },
  {
    articleSlug:
      "2026-06-23-dubai-launches-flexi-rent-12-landlords-offer-monthly-instalm",
    areaSlugs: [],
    developerSlugs: [],
  },
  {
    articleSlug:
      "2026-06-22-oman-scraps-sponsor-mandate-for-property-linked-residency-pe",
    areaSlugs: [],
    developerSlugs: [],
  },
  {
    articleSlug:
      "2026-06-22-from-dhoom-to-dubai-how-rimi-sen-traded-bollywood-for-luxury",
    areaSlugs: [],
    developerSlugs: [],
  },
  {
    articleSlug:
      "2026-06-20-ahs-properties-acquires-shangri-la-dubai-for-dh1-1bn-eyes-dh",
    areaSlugs: [],
    developerSlugs: [],
  },
  {
    articleSlug:
      "2026-06-18-dld-expands-barwa-programme-with-workshops-after-serving-18-",
    areaSlugs: [],
    developerSlugs: [],
  },
  {
    articleSlug:
      "2026-06-18-abu-dhabi-residential-sales-hit-dh38-1bn-in-record-q1-2026",
    areaSlugs: [],
    developerSlugs: [],
  },
  {
    articleSlug:
      "2026-06-17-dir-completes-189-villa-delivery-at-danah-bay-as-rak-gains-i",
    areaSlugs: ["al-marjan-island"],
    developerSlugs: [],
  },
  {
    articleSlug:
      "2026-06-14-branded-residences-command-64-premium-as-dubai-buyers-chase-",
    areaSlugs: [],
    developerSlugs: [],
  },
  {
    articleSlug:
      "2026-06-13-palm-jumeirah-handover-2026-two-sold-out-towers-test-the-cre",
    areaSlugs: ["palm-jumeirah"],
    developerSlugs: [],
  },
  {
    articleSlug:
      "2026-06-12-dubai-luxury-off-plan-sales-hit-aed4-96bn-in-may",
    areaSlugs: [],
    developerSlugs: [],
  },
  {
    articleSlug:
      "2026-06-11-emaar-unveils-dh200bn-masterplan-for-150-000-residents-in-du",
    areaSlugs: [],
    developerSlugs: ["emaar"],
  },
  {
    articleSlug:
      "2026-06-10-shangri-la-dubai-sells-for-dh1-1bn-as-sheikh-zayed-road-valu",
    areaSlugs: [],
    developerSlugs: [],
  },
  {
    articleSlug:
      "2026-06-10-cbd-and-dubai-holding-real-estate-launch-aed-157-9bn-backed-",
    areaSlugs: [],
    developerSlugs: [],
  },
  {
    articleSlug:
      "2026-06-07-dubai-logs-dhs28-51bn-in-may-property-deals-as-off-plan-abso",
    areaSlugs: [],
    developerSlugs: [],
  },
  {
    articleSlug:
      "2026-06-06-dubai-s-off-plan-dominance-66-900-sales-in-five-months-as-ma",
    areaSlugs: [],
    developerSlugs: [],
  },
  {
    articleSlug:
      "2026-06-05-abu-dhabi-s-rent-freeze-a-structural-intervention-in-the-cap",
    areaSlugs: [],
    developerSlugs: [],
  },
  {
    articleSlug:
      "2026-05-31-al-barari-villa-leased-for-aed-14-million-sets-dubai-rental-",
    areaSlugs: [],
    developerSlugs: [],
  },
  {
    articleSlug:
      "2026-05-30-al-barari-villa-lease-resets-dubai-ultra-prime-rental-ceilin",
    areaSlugs: [],
    developerSlugs: [],
  },
  {
    articleSlug:
      "2026-05-30-dubai-s-19-6m-visitors-drive-luxury-property-surge-as-touris",
    areaSlugs: [],
    developerSlugs: [],
  },
  {
    articleSlug:
      "2026-06-17-dir-completes-189-villa-delivery-at-danah-bay-as-rak-absorbs",
    areaSlugs: ["al-marjan-island"],
    developerSlugs: [],
  },
] as const satisfies readonly ArticleRelationRecord[];

const AREAS_BY_SLUG = new Map(AREAS.map((area) => [area.slug, area]));
const DEVELOPERS_BY_SLUG = new Map(
  DEVELOPERS.map((developer) => [developer.slug, developer]),
);

function assertUniqueTargets(
  values: readonly string[],
  context: string,
): void {
  if (new Set(values).size !== values.length) {
    throw new Error(`Duplicate ${context} relation target.`);
  }
}

export function validateArticleRelationRecords(
  records: readonly ArticleRelationRecord[],
  articles: readonly NewsArticle[] = NEWS_ARTICLES,
): void {
  const publishedSlugs = new Set(
    articles
      .filter((article) => article.status !== "research")
      .map((article) => article.slug),
  );
  const seen = new Set<string>();

  for (const record of records) {
    if (!publishedSlugs.has(record.articleSlug)) {
      throw new Error(
        `Unknown published article relation: ${record.articleSlug}`,
      );
    }
    if (seen.has(record.articleSlug)) {
      throw new Error(`Duplicate article relation: ${record.articleSlug}`);
    }
    seen.add(record.articleSlug);

    assertUniqueTargets(record.areaSlugs, `${record.articleSlug} area`);
    assertUniqueTargets(
      record.developerSlugs,
      `${record.articleSlug} developer`,
    );

    for (const areaSlug of record.areaSlugs) {
      const area = AREAS_BY_SLUG.get(areaSlug);
      if (!area) {
        throw new Error(`Unknown advisory area relation: ${areaSlug}`);
      }
      if (advisoryLinksForArea(area).length === 0) {
        throw new Error(
          `Area relation has no canonical advisory destination: ${areaSlug}`,
        );
      }
    }

    for (const developerSlug of record.developerSlugs) {
      const developer = DEVELOPERS_BY_SLUG.get(developerSlug);
      if (!developer) {
        throw new Error(
          `Unknown advisory developer relation: ${developerSlug}`,
        );
      }
      if (!advisoryLinkForDeveloper(developer.slug, developer.name)) {
        throw new Error(
          `Developer relation has no canonical advisory destination: ${developerSlug}`,
        );
      }
    }
  }

  const missing = [...publishedSlugs].filter((slug) => !seen.has(slug));
  if (missing.length > 0) {
    throw new Error(`Missing explicit article relations: ${missing.join(", ")}`);
  }
}

validateArticleRelationRecords(ARTICLE_RELATION_RECORDS);

const RELATIONS_BY_ARTICLE = new Map<string, ArticleRelationRecord>(
  ARTICLE_RELATION_RECORDS.map((record) => [record.articleSlug, record]),
);

export function getArticleRelationRecord(
  articleSlug: string,
): ArticleRelationRecord {
  const record = RELATIONS_BY_ARTICLE.get(articleSlug);
  if (!record) {
    throw new Error(`Unknown published article relation: ${articleSlug}`);
  }
  return record;
}

export function resolveArticleRelations(articleSlug: string): Readonly<{
  areas: readonly ResolvedArticleArea[];
  developers: readonly ResolvedArticleDeveloper[];
}> {
  const record = getArticleRelationRecord(articleSlug);
  const areas = record.areaSlugs.map((slug) => {
    const area = AREAS_BY_SLUG.get(slug);
    if (!area) throw new Error(`Unknown advisory area relation: ${slug}`);
    return {
      slug,
      name: area.name,
      advisoryLinks: advisoryLinksForArea(area),
    };
  });
  const developers = record.developerSlugs.map((slug) => {
    const developer = DEVELOPERS_BY_SLUG.get(slug);
    if (!developer) {
      throw new Error(`Unknown advisory developer relation: ${slug}`);
    }
    const advisoryLink = advisoryLinkForDeveloper(
      developer.slug,
      developer.name,
    );
    if (!advisoryLink) {
      throw new Error(
        `Developer relation has no canonical advisory destination: ${slug}`,
      );
    }
    return { slug, name: developer.name, advisoryLink };
  });

  return { areas, developers };
}
