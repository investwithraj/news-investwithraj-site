import { AREAS, type AreaPage } from "@/content/areas";
import { NEWS_ARTICLES, sortNewsArticles } from "@/content/news";
import type { NewsArticle } from "@/content/news/types";
import evidenceRemediation from "@/docs/migration/newsroom-legacy-evidence-remediation.json";
import { DEVELOPERS, type DeveloperProfile } from "@/lib/developers";
import {
  articleMentionsArea,
  articleMentionsDeveloper,
} from "@/lib/news-editorial";
import {
  isIndexEligibleArticleSlug,
  isNewsroomLifecycleCutoverEnabled,
  isRenderableArticleSlug,
} from "@/lib/news-lifecycle";

/**
 * The single publication boundary for registry-backed public pages.
 *
 * Registries may contain research records for internal matching, ingestion and
 * future coverage. A record becomes a public destination only after at least
 * one published article explicitly matches it. Public routes, navigation,
 * schema and sitemaps must consume the exports below instead of the raw
 * registries.
 */
export const PUBLISHED_NEWS_ARTICLES: NewsArticle[] = sortNewsArticles(
  NEWS_ARTICLES,
).filter((article) => article.status !== "research");

/**
 * Canonical public discovery boundary for the lifecycle preview.
 *
 * Published records remain available above for editorial/internal integrity;
 * only KEEP and IMPROVE records may enter navigation, schema or feeds.
 */
export const INDEXABLE_NEWS_ARTICLES: NewsArticle[] =
  PUBLISHED_NEWS_ARTICLES.filter((article) =>
    isIndexEligibleArticleSlug(article.slug),
  );

export const NEWSROOM_EVIDENCE_HOLD_PREVIEW_ENV =
  "NEWSROOM_EVIDENCE_HOLD_PREVIEW" as const;

type EvidenceHoldEnvironment = Readonly<
  Record<string, string | undefined>
>;

export const NEWSROOM_EVIDENCE_HOLD_SLUGS = Object.freeze(
  evidenceRemediation.records.map((record) => record.slug),
);

const newsroomEvidenceHoldSlugs = new Set(NEWSROOM_EVIDENCE_HOLD_SLUGS);

export function isNewsroomEvidenceHoldPreviewEnabled(
  environment: EvidenceHoldEnvironment = process.env,
): boolean {
  return (
    environment[NEWSROOM_EVIDENCE_HOLD_PREVIEW_ENV] === "1" &&
    environment.VERCEL_ENV !== "production"
  );
}

export function isNewsroomEvidenceHeldArticleSlug(
  slug: string,
  environment: EvidenceHoldEnvironment = process.env,
): boolean {
  return (
    isNewsroomEvidenceHoldPreviewEnabled(environment) &&
    newsroomEvidenceHoldSlugs.has(slug)
  );
}

export const EVIDENCE_CERTIFIED_INDEXABLE_NEWS_ARTICLES: NewsArticle[] =
  INDEXABLE_NEWS_ARTICLES.filter(
    (article) =>
      article.publicationContentHash &&
      !newsroomEvidenceHoldSlugs.has(article.slug),
  );

/**
 * Public discovery is release-aware. Before explicit legacy cutover, existing
 * live records stay discoverable except for individually released duplicate
 * redirects. Once the single lifecycle flag is enabled, only the approved
 * KEEP + IMPROVE projection is emitted.
 */
export function getLifecycleProjectedNewsArticles(): NewsArticle[] {
  return isNewsroomLifecycleCutoverEnabled()
    ? INDEXABLE_NEWS_ARTICLES
    : PUBLISHED_NEWS_ARTICLES.filter((article) =>
        isRenderableArticleSlug(article.slug),
      );
}

export function getPublicDiscoveryNewsArticles(): NewsArticle[] {
  const lifecycleProjection = getLifecycleProjectedNewsArticles();
  return isNewsroomEvidenceHoldPreviewEnabled()
    ? lifecycleProjection.filter(
        (article) => !newsroomEvidenceHoldSlugs.has(article.slug),
      )
    : lifecycleProjection;
}

export function isPublicDiscoveryNewsArticleSlug(slug: string): boolean {
  return getPublicDiscoveryNewsArticles().some(
    (article) => article.slug === slug,
  );
}

export type PublicAreaRecord = {
  area: AreaPage;
  reports: NewsArticle[];
};

export type PublicDeveloperRecord = {
  developer: DeveloperProfile;
  reports: NewsArticle[];
};

/**
 * Area/developer directory metadata must use the same release projection as
 * every other discovery surface. Otherwise a preserved redirect-source record
 * can still inflate report counts and last-modified timestamps after its public
 * article has been retired.
 */
const PUBLIC_OVERVIEW_NEWS_ARTICLES = getPublicDiscoveryNewsArticles();

export const PUBLIC_AREA_RECORDS: PublicAreaRecord[] = AREAS.map((area) => ({
  area,
  reports: PUBLIC_OVERVIEW_NEWS_ARTICLES.filter((article) =>
    articleMentionsArea(article, area),
  ),
})).filter(({ reports }) => reports.length > 0);

export const PUBLIC_AREAS: AreaPage[] = PUBLIC_AREA_RECORDS.map(
  ({ area }) => area,
);

export const PUBLIC_DEVELOPER_RECORDS: PublicDeveloperRecord[] = DEVELOPERS.map(
  (developer) => ({
    developer,
    reports: PUBLIC_OVERVIEW_NEWS_ARTICLES.filter((article) =>
      articleMentionsDeveloper(article, developer),
    ),
  }),
).filter(({ reports }) => reports.length > 0);

export const PUBLIC_DEVELOPERS: DeveloperProfile[] =
  PUBLIC_DEVELOPER_RECORDS.map(({ developer }) => developer);

export function getPublicAreaRecord(
  slug: string,
): PublicAreaRecord | null {
  return PUBLIC_AREA_RECORDS.find(({ area }) => area.slug === slug) ?? null;
}

export function getPublicDeveloperRecord(
  slug: string,
): PublicDeveloperRecord | null {
  return (
    PUBLIC_DEVELOPER_RECORDS.find(
      ({ developer }) => developer.slug === slug,
    ) ?? null
  );
}

export function getAllPublicAreaSlugs(): string[] {
  return PUBLIC_AREAS.map((area) => area.slug);
}

export function getAllPublicDeveloperSlugs(): string[] {
  return PUBLIC_DEVELOPERS.map((developer) => developer.slug);
}
