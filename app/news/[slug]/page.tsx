import type { Metadata } from "next";
import { notFound } from "next/navigation";

import NewsArticle from "@/components/redesign/NewsArticle";
import { getNewsBySlug, NEWS_ARTICLES } from "@/content/news";
import { resolveArticleRelations } from "@/lib/article-relations";
import { SITE } from "@/lib/constants";
import {
  getNewsArticleLifecycle,
  isRenderableArticleSlug,
} from "@/lib/news-lifecycle";
import {
  isIndexablePublicNewsArticleSlug,
} from "@/lib/news-discovery";
import { getPublicDiscoveryNewsArticles } from "@/lib/public-content";
import { newsArticleMetadata } from "@/lib/news-metadata";
import {
  hasVerifiedEditorialImage,
  relatedVerticalsForArticle,
} from "@/lib/news-editorial";
import {
  asGraph,
  BREADCRUMB_PRESETS,
  breadcrumbSchema,
  faqPageSchema,
  newsArticleSchema,
  newsImageObjectSchema,
} from "@/lib/schema";
import { VERTICALS } from "@/lib/verticals";

export const dynamicParams = false;
export const dynamic = "force-static";

export function generateStaticParams() {
  return NEWS_ARTICLES
    .filter(
      (article) =>
        article.status !== "research" &&
        isRenderableArticleSlug(article.slug),
    )
    .map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = getNewsBySlug(slug);
  const lifecycle = getNewsArticleLifecycle(slug);
  if (
    !article ||
    article.status === "research" ||
    !lifecycle ||
    !isRenderableArticleSlug(slug)
  ) {
    return {
      title: "Article not found",
      robots: { index: false, follow: false },
    };
  }

  return newsArticleMetadata(article);
}

export default async function NewsArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = getNewsBySlug(slug);
  const lifecycle = getNewsArticleLifecycle(slug);
  if (
    !article ||
    article.status === "research" ||
    !lifecycle ||
    !isRenderableArticleSlug(slug)
  ) {
    notFound();
  }

  const articleUrl = `${SITE.url}/news/${article.slug}`;
  const indexEligible = isIndexablePublicNewsArticleSlug(article.slug);
  const hasImage = hasVerifiedEditorialImage(article);
  const imageUrl = `${SITE.url}/api/og?slug=${encodeURIComponent(article.slug)}`;
  const graph = indexEligible
    ? asGraph(
        newsArticleSchema(article, imageUrl),
        article.faq.length > 0 ? faqPageSchema(article.faq) : null,
        breadcrumbSchema(
          BREADCRUMB_PRESETS.news({
            slug: article.slug,
            title: article.title,
          }),
        ),
        newsImageObjectSchema({
          pageUrl: articleUrl,
          imageUrl,
          caption: hasImage ? article.heroImage.credit : article.title,
        }),
      )
    : null;

  const live = getPublicDiscoveryNewsArticles();
  const index = live.findIndex((item) => item.slug === slug);
  const newer = index > 0 ? live[index - 1] : null;
  const older = index >= 0 && index < live.length - 1 ? live[index + 1] : null;
  const explicitRelations = resolveArticleRelations(article.slug);
  const relatedAreas = explicitRelations.areas.slice(0, 4);
  const relatedDevelopers = explicitRelations.developers.slice(0, 4);
  const relatedVerticals = relatedVerticalsForArticle(
    article,
    VERTICALS,
  ).slice(0, 3);

  return (
    <>
      {article.publicationContentHash ? (
        <meta
          name="iwr-content-hash"
          content={article.publicationContentHash}
        />
      ) : null}
      {graph ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(graph).replace(/</g, "\\u003c"),
          }}
        />
      ) : null}
      <NewsArticle
        article={article}
        newer={newer}
        older={older}
        relatedAreas={relatedAreas}
        relatedDevelopers={relatedDevelopers}
        relatedVerticals={relatedVerticals}
      />
    </>
  );
}
