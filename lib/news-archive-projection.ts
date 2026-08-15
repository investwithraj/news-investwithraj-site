import {
  sortNewsArticles,
  type NewsArticle,
} from "@/content/news/types";
import { planDistinctArticleMedia } from "@/lib/article-display-media";
import { resolveArticleRelations } from "@/lib/article-relations";
import type {
  NewsArchiveDesk,
  NewsArchiveItem,
} from "@/lib/news-archive";
import {
  categoryLabel,
  decisionCta,
  displayMarkets,
  evidenceSummary,
} from "@/lib/news-editorial";
import { articleMatchesVertical, VERTICALS } from "@/lib/verticals";

export const NEWS_ARCHIVE_DESKS: NewsArchiveDesk[] = VERTICALS.map(
  ({ slug, name, description }) => ({ slug, name, description }),
);

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
    const relations = resolveArticleRelations(article.slug);
    const advisoryLinks = [
      ...relations.areas.flatMap((area) => area.advisoryLinks),
      ...relations.developers.map((developer) => developer.advisoryLink),
    ];

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
      areas: relations.areas.map(({ slug, name }) => ({ slug, name })),
      developers: relations.developers.map(({ slug, name }) => ({
        slug,
        name,
      })),
      evidenceLabel: evidence.label,
      evidenceLimited: evidence.limited,
      // The archive is an editorial surface, so broad entity imagery is not
      // promoted to report imagery. Context assets remain available on the
      // surfaces that explicitly label them as context.
      media: plannedMedia?.label === "Report image" ? plannedMedia : null,
      advisoryLinks: [
        ...new Map(advisoryLinks.map((link) => [link.href, link])).values(),
      ].slice(0, 2),
      decisionCta: {
        href: cta.href,
        label: cta.label,
      },
    };
  });
}
