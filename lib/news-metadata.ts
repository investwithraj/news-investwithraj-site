import type { Metadata } from "next";

import type { NewsArticle } from "@/content/news/types";
import { SITE } from "@/lib/constants";
import { isIndexablePublicNewsArticleSlug } from "@/lib/news-discovery";
import {
  displayMarkets,
  hasVerifiedEditorialImage,
  supportedImageAlt,
} from "@/lib/news-editorial";

/** Metadata shared by the article route and discovery-consistency tests. */
export function newsArticleMetadata(article: NewsArticle): Metadata {
  const url = `${SITE.url}/news/${article.slug}`;
  const imageUrl = `${SITE.url}/api/og?slug=${encodeURIComponent(article.slug)}`;
  const hasImage = hasVerifiedEditorialImage(article);
  const indexable = isIndexablePublicNewsArticleSlug(article.slug);

  return {
    title: article.title,
    description: article.metaDescription || article.subtitle,
    robots: {
      index: indexable,
      follow: true,
      // Route metadata replaces (rather than deep-merges) layout robots.
      // Preserve large-image eligibility without making held articles indexable.
      googleBot: {
        index: indexable,
        follow: true,
        "max-image-preview": "large",
        "max-video-preview": -1,
        "max-snippet": -1,
      },
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
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: hasImage ? supportedImageAlt(article) : article.title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: article.title,
      description: article.metaDescription || article.subtitle,
      images: [imageUrl],
    },
  };
}
