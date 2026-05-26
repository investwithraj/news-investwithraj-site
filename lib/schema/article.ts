// JSON-LD generators for NewsArticle + Article + Speakable + FAQPage.
// Per-page schema injection helpers — called from /news/[slug]/page.tsx
// + /insights/[slug]/page.tsx.

import { SITE } from "@/lib/constants";
import type { NewsArticle, FaqItem } from "@/content/news/types";
import type { InsightArticle } from "@/content/insights/types";
import { rajPersonRef } from "./person";
import { newsOrgRef } from "./organization";

/** NewsArticle JSON-LD — the headliner schema for /news/[slug] pages.
 *  Google News + Top Stories indexing depends on this being correct. */
export function newsArticleSchema(article: NewsArticle): Record<string, unknown> {
  const url = `${SITE.url}/news/${article.slug}`;
  return {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    "@id": `${url}#article`,
    headline: article.title,
    description: article.metaDescription ?? article.subtitle,
    image: article.heroImage.src.startsWith("http")
      ? article.heroImage.src
      : `${SITE.url}${article.heroImage.src}`,
    datePublished: article.publishedAt,
    dateModified: article.modifiedAt,
    author: rajPersonRef,
    publisher: newsOrgRef,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    articleSection: article.category,
    keywords: article.market.join(", "),
    inLanguage: "en-US",
    isAccessibleForFree: true,
    isPartOf: { "@type": "WebSite", "@id": `${SITE.url}#website` },
    speakable: speakableSchema(article.speakableSelector),
    citation: article.citations.map((c) => ({
      "@type": "CreativeWork",
      name: c.source,
      url: c.url,
    })),
  };
}

/** Article JSON-LD — for /insights/[slug] pages (long-form deep-dives).
 *  Slightly different from NewsArticle — uses "Article" + adds wordCount,
 *  readTimeMin → timeRequired, and isPartOf an InsightSeries collection. */
export function insightArticleSchema(article: InsightArticle): Record<string, unknown> {
  const url = `${SITE.url}/insights/${article.slug}`;
  const canonical = article.linkedinUrl ?? url;
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    "@id": `${url}#article`,
    headline: article.title,
    description: article.excerpt,
    image: article.heroImage.src.startsWith("http")
      ? article.heroImage.src
      : `${SITE.url}${article.heroImage.src}`,
    datePublished: article.publishedAt,
    dateModified: article.modifiedAt,
    author: rajPersonRef,
    publisher: newsOrgRef,
    mainEntityOfPage: { "@type": "WebPage", "@id": canonical },
    articleSection: article.category,
    keywords: article.market.join(", "),
    inLanguage: "en-US",
    wordCount: countWords(article.body),
    timeRequired: `PT${article.readTimeMin}M`,
    isAccessibleForFree: true,
    isPartOf: { "@type": "WebSite", "@id": `${SITE.url}#website` },
    speakable: speakableSchema(article.speakableSelector),
    citation: article.citations.map((c) => ({
      "@type": "CreativeWork",
      name: c.source,
      url: c.url,
    })),
  };
}

/** Speakable — voice-assistant excerpts. Defaults to the article's
 *  TLDR + first paragraph if no explicit selectors provided.
 *  Used by Google Assistant + Alexa Flash Briefings. */
export function speakableSchema(selectors?: string[]) {
  return {
    "@type": "SpeakableSpecification",
    cssSelector: selectors ?? [".article-tldr", ".article-body p:first-of-type"],
  };
}

/** FAQPage JSON-LD — emitted alongside articles when they include FAQ
 *  items. Drives rich-result FAQ accordions in Google search. */
export function faqPageSchema(faq: FaqItem[]): Record<string, unknown> | null {
  if (!faq || faq.length === 0) return null;
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.a,
      },
    })),
  };
}

/* ─── Helpers ───────────────────────────────────────────────────────── */

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter((w) => w.length > 0).length;
}
