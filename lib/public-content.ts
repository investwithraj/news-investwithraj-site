import { AREAS, type AreaPage } from "@/content/areas";
import { NEWS_ARTICLES, sortNewsArticles } from "@/content/news";
import type { NewsArticle } from "@/content/news/types";
import { DEVELOPERS, type DeveloperProfile } from "@/lib/developers";
import {
  articleMentionsArea,
  articleMentionsDeveloper,
} from "@/lib/news-editorial";

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

export type PublicAreaRecord = {
  area: AreaPage;
  reports: NewsArticle[];
};

export type PublicDeveloperRecord = {
  developer: DeveloperProfile;
  reports: NewsArticle[];
};

export const PUBLIC_AREA_RECORDS: PublicAreaRecord[] = AREAS.map((area) => ({
  area,
  reports: PUBLISHED_NEWS_ARTICLES.filter((article) =>
    articleMentionsArea(article, area),
  ),
})).filter(({ reports }) => reports.length > 0);

export const PUBLIC_AREAS: AreaPage[] = PUBLIC_AREA_RECORDS.map(
  ({ area }) => area,
);

export const PUBLIC_DEVELOPER_RECORDS: PublicDeveloperRecord[] = DEVELOPERS.map(
  (developer) => ({
    developer,
    reports: PUBLISHED_NEWS_ARTICLES.filter((article) =>
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
