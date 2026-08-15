import {
  sortNewsArticles,
  type NewsArticle,
} from "@/content/news/types";
import { planDistinctArticleMedia } from "@/lib/article-display-media";
import {
  advisoryLinkForDeveloper,
  advisoryLinksForArea,
  type AdvisoryLink,
} from "@/lib/advisory-relations";
import type {
  NewsArchiveAdvisoryLink,
  NewsArchiveDesk,
  NewsArchiveItem,
} from "@/lib/news-archive";
import {
  categoryLabel,
  decisionCta,
  displayMarkets,
  evidenceSummary,
  relatedAreasForArticle,
  relatedDevelopersForArticle,
} from "@/lib/news-editorial";
import { PUBLIC_AREAS, PUBLIC_DEVELOPERS } from "@/lib/public-content";
import { articleMatchesVertical, VERTICALS } from "@/lib/verticals";

export const NEWS_ARCHIVE_DESKS: NewsArchiveDesk[] = VERTICALS.map(
  ({ slug, name, description }) => ({ slug, name, description }),
);

function contextualAdvisoryLinks(
  article: NewsArticle,
): NewsArchiveAdvisoryLink[] {
  const candidates: AdvisoryLink[] = [];

  for (const area of relatedAreasForArticle(article, PUBLIC_AREAS)) {
    candidates.push(...advisoryLinksForArea(area));
  }

  for (const developer of relatedDevelopersForArticle(
    article,
    PUBLIC_DEVELOPERS,
  )) {
    const link = advisoryLinkForDeveloper(developer.slug, developer.name);
    if (link) candidates.push(link);
  }

  return [
    ...new Map(candidates.map((link) => [link.href, link])).values(),
  ].slice(0, 2);
}

export function projectNewsArchiveItems(
  articles: NewsArticle[],
): NewsArchiveItem[] {
  const published = sortNewsArticles(articles).filter(
    (article) => article.status !== "research",
  );
  const mediaPlan = planDistinctArticleMedia(published);

  return published.map((article) => {
    const evidence = evidenceSummary(article);
    const cta = decisionCta(article);
    const plannedMedia = mediaPlan.get(article.slug);

    return {
      slug: article.slug,
      title: article.title,
      subtitle: article.subtitle,
      publishedAt: article.publishedAt,
      displayDate: article.displayDate,
      category: article.category,
      categoryLabel: categoryLabel(article.category),
      markets: displayMarkets(article),
      desks: VERTICALS.filter((vertical) =>
        articleMatchesVertical(vertical, article),
      ).map(({ slug, name }) => ({ slug, name })),
      evidenceLabel: evidence.label,
      evidenceLimited: evidence.limited,
      // The archive is an editorial surface, so broad entity imagery is not
      // promoted to report imagery. Context assets remain available on the
      // surfaces that explicitly label them as context.
      media: plannedMedia?.label === "Report image" ? plannedMedia : null,
      advisoryLinks: contextualAdvisoryLinks(article),
      decisionCta: {
        href: cta.href,
        label: cta.label,
      },
    };
  });
}
