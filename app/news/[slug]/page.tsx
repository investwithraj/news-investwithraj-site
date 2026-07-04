// Individual news article page — /news/[slug]
//
// Server component renders SemaformLayout + emits NewsArticle + FAQPage +
// Breadcrumb + Speakable JSON-LD as a single @graph.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getNewsBySlug, getAllNewsSlugs, NEWS_ARTICLES } from "@/content/news";
import { SemaformLayout } from "@/components/article/SemaformLayout";
import PageMotion from "@/components/v21/PageMotion";
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

  // Prev/next — chronological neighbours from the live registry (research
  // stubs excluded). "Newer" = published after this one, "older" = before.
  const live = [...NEWS_ARTICLES]
    .filter((a) => a.status !== "research")
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  const idx = live.findIndex((a) => a.slug === slug);
  const newer = idx > 0 ? live[idx - 1] : null;
  const older = idx >= 0 && idx < live.length - 1 ? live[idx + 1] : null;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(graph) }}
      />
      {/* V21 brand-motion unification — ONE static atmosphere touch: the
          main site's cinema plate (plate-1.webp) as a low-opacity masthead
          accent behind the article head, faded out by a paper scrim so the
          text keeps full priority. Decorative only; no motion on the
          article body; the article hero photo itself stays a REAL photo. */}
      <div className="relative">
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 pointer-events-none select-none"
          style={{
            height: "clamp(240px, 34vh, 380px)",
            backgroundImage: "url(/cinema/v21/plate-1.webp)",
            backgroundSize: "cover",
            backgroundPosition: "center 30%",
            opacity: 0.14,
          }}
        />
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 pointer-events-none"
          style={{
            height: "clamp(240px, 34vh, 380px)",
            background:
              "linear-gradient(180deg, rgba(245, 241, 237, 0.45) 0%, rgba(245, 241, 237, 0.72) 55%, var(--paper) 100%)",
          }}
        />
        <div className="relative">
          {/* V21 kinetic head — arms the data-split line-cascade on the h1
              inside SemaformLayout. Only the headline moves; the article
              BODY gets zero motion (restraint cut-line). */}
          <PageMotion />
          <SemaformLayout article={article} />

          {/* Prev/next article nav — registry-chronological, mono links,
              deliberately static (no motion). */}
          {(older || newer) && (
            <nav
              aria-label="More from the desk"
              className="max-w-[760px] mx-auto px-6 md:px-8 pb-16 md:pb-24"
            >
              <div
                className="pt-8 border-t grid grid-cols-1 md:grid-cols-2 gap-6"
                style={{ borderColor: "var(--gold-soft)" }}
              >
                <div>
                  {older && (
                    <Link href={`/news/${older.slug}`} className="group block">
                      <span
                        className="block text-[10px] font-mono uppercase tracking-[0.22em] mb-2"
                        style={{ color: "var(--ink-faint)" }}
                      >
                        ← Previous · {older.displayDate}
                      </span>
                      <span
                        className="block text-sm font-mono leading-[1.5] transition-colors group-hover:text-[var(--gold-deep)]"
                        style={{ color: "var(--ink-soft)" }}
                      >
                        {older.title}
                      </span>
                    </Link>
                  )}
                </div>
                <div className="md:text-right">
                  {newer && (
                    <Link href={`/news/${newer.slug}`} className="group block">
                      <span
                        className="block text-[10px] font-mono uppercase tracking-[0.22em] mb-2"
                        style={{ color: "var(--ink-faint)" }}
                      >
                        Next · {newer.displayDate} →
                      </span>
                      <span
                        className="block text-sm font-mono leading-[1.5] transition-colors group-hover:text-[var(--gold-deep)]"
                        style={{ color: "var(--ink-soft)" }}
                      >
                        {newer.title}
                      </span>
                    </Link>
                  )}
                </div>
              </div>
            </nav>
          )}
        </div>
      </div>
    </>
  );
}
