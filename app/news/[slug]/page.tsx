// Individual news article page — /news/[slug]
//
// Server component renders SemaformLayout + emits NewsArticle + FAQPage +
// Breadcrumb + Speakable JSON-LD as a single @graph.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getNewsBySlug, getAllNewsSlugs } from "@/content/news";
import { SemaformLayout } from "@/components/article/SemaformLayout";
import {
  newsArticleSchema,
  faqPageSchema,
  speakableSchema,
  breadcrumbSchema,
  BREADCRUMB_PRESETS,
  asGraph,
} from "@/lib/schema";
import { SITE } from "@/lib/constants";

export const dynamicParams = false;
export const dynamic = "force-static";

export function generateStaticParams() {
  return getAllNewsSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = getNewsBySlug(slug);
  if (!article) return { title: "Article not found" };

  const url = `${SITE.url}/news/${slug}`;
  // Always route OG/Twitter cards through /api/og — it generates a branded
  // 1200×630 PNG using a real stock photo (Unsplash/Pexels/Wikimedia) plus
  // the navy/gold/Fraunces brand wrap. Falls back to article.heroImage.src
  // only if /api/og is unavailable.
  const ogUrl = `${SITE.url}/api/og?slug=${slug}`;
  return {
    title: article.title,
    description: article.metaDescription || article.subtitle,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      url,
      title: article.title,
      description: article.metaDescription || article.subtitle,
      publishedTime: article.publishedAt,
      modifiedTime: article.modifiedAt,
      authors: [`${SITE.rootUrl}#raj`],
      tags: [article.category, ...article.market],
      images: [{ url: ogUrl, width: 1200, height: 630, alt: article.heroImage.alt }],
    },
    twitter: {
      card: "summary_large_image",
      title: article.title,
      description: article.metaDescription || article.subtitle,
      images: [ogUrl],
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
  if (!article) notFound();

  const articleUrl = `${SITE.url}/news/${slug}`;

  // Build the @graph — NewsArticle + (optional) FAQPage + Breadcrumb
  // (NewsArticle schema already includes Speakable inline)
  const graph = asGraph(
    newsArticleSchema(article),
    article.faq && article.faq.length > 0 ? faqPageSchema(article.faq) : null,
    breadcrumbSchema(
      BREADCRUMB_PRESETS.news({
        slug: article.slug,
        title: article.title,
      })
    )
  );

  // Suppress unused-import warning for articleUrl + speakableSchema
  void articleUrl;
  void speakableSchema;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(graph) }}
      />
      <SemaformLayout article={article} />
    </>
  );
}
