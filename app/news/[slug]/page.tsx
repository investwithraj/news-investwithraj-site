import type { Metadata } from "next";
import { notFound } from "next/navigation";

import NewsArticle from "@/components/redesign/NewsArticle";
import { getNewsBySlug, NEWS_ARTICLES } from "@/content/news";
import { resolveArticleRelations } from "@/lib/article-relations";
import { SITE } from "@/lib/constants";
import {
  getNewsArticleLifecycle,
  isReleasedIndexEligiblePath,
  isRenderableArticleSlug,
} from "@/lib/news-lifecycle";
import {
  displayMarkets,
  hasVerifiedEditorialImage,
  relatedVerticalsForArticle,
  supportedImageAlt,
} from "@/lib/news-editorial";
import { getPublicDiscoveryNewsArticles } from "@/lib/public-content";
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

  const url = `${SITE.url}/news/${slug}`;
  const hasImage = hasVerifiedEditorialImage(article);
  const imageUrl = article.heroImage.src.startsWith("http")
    ? article.heroImage.src
    : `${SITE.url}${article.heroImage.src}`;

  return {
    title: article.title,
    description: article.metaDescription || article.subtitle,
    robots: {
      index: isReleasedIndexEligiblePath(`/news/${slug}`),
      follow: true,
    },
    alternates: {
      canonical: url,
      types: { "application/rss+xml": `${SITE.url}/rss.xml` },
    },
    openGraph: {
      type: "article",
      url,
      title: article.title,
      description: article.metaDescription || article.subtitle,
      publishedTime: article.publishedAt,
      modifiedTime: article.modifiedAt,
      tags: [article.category, ...displayMarkets(article)],
      ...(hasImage
        ? {
            images: [
              {
                url: imageUrl,
                alt: supportedImageAlt(article),
              },
            ],
          }
        : {}),
    },
    twitter: {
      card: hasImage ? "summary_large_image" : "summary",
      title: article.title,
      description: article.metaDescription || article.subtitle,
      ...(hasImage ? { images: [imageUrl] } : {}),
    },
  };
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
  const indexEligible = isReleasedIndexEligiblePath(
    `/news/${article.slug}`,
  );
  const hasImage = hasVerifiedEditorialImage(article);
  const imageUrl = article.heroImage.src.startsWith("http")
    ? article.heroImage.src
    : `${SITE.url}${article.heroImage.src}`;
  const graph = indexEligible
    ? asGraph(
        newsArticleSchema(article),
        article.faq.length > 0 ? faqPageSchema(article.faq) : null,
        breadcrumbSchema(
          BREADCRUMB_PRESETS.news({
            slug: article.slug,
            title: article.title,
          }),
        ),
        hasImage
          ? newsImageObjectSchema({
              pageUrl: articleUrl,
              imageUrl,
              caption: article.heroImage.credit,
            })
          : null,
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
