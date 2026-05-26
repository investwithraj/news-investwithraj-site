// Insight article schema — long-form weekly deep-dives at /insights/[slug].
// 1-2 per week, PR-reviewed before commit (vs news which auto-publishes).
// Often mirrors a Beyond the Deal LinkedIn newsletter edition (with
// rel=canonical → LinkedIn URL when so).

import type {
  Citation,
  HeroImage,
  Cta,
  DistributionConfig,
  FaqItem,
} from "@/content/news/types";

export type InsightCategory =
  | "thesis"          // long-form thesis pieces (a Knight-Frank-Wealth-Report-style read)
  | "deep-dive"       // single-asset / single-developer / single-area deep-dive
  | "thematic"        // cross-cutting themes (Golden Visa, cross-border, Family Office)
  | "linkedin-mirror" // 1:1 mirror of a Beyond the Deal LinkedIn edition
  | "market-quarterly"; // quarterly state-of-the-market

export interface InsightArticle {
  /** URL slug at /insights/{slug} */
  slug: string;
  /** Headline ≤ 90 chars */
  title: string;
  /** One-line dek */
  subtitle: string;
  /** ISO publish timestamp */
  publishedAt: string;
  /** ISO last modified */
  modifiedAt: string;
  /** Display date */
  displayDate: string;
  /** Always raj-tomar */
  author: "raj-tomar";
  /** Always "insight" for this type */
  tier: "insight";
  /** Category */
  category: InsightCategory;
  /** Geographic anchor */
  market: ("Dubai" | "Abu Dhabi" | "Ras Al Khaimah" | "UAE" | "GCC")[];
  /** Standfirst paragraph shown immediately after the title — 1-3 sentences */
  excerpt: string;
  /** 3-5 key takeaways shown as a callout box near the top */
  keyTakeaways: string[];
  /** Long-form body — paragraphs separated by \n\n.
   *  Word count target 2500-3500 (validator gate 7). */
  body: string;
  /** 5-8 FAQ items emitted as FAQPage JSON-LD */
  faq: FaqItem[];
  /** ≥2 from lib/sources/registry whitelist (insights have stricter citation bar) */
  citations: Citation[];
  /** Hero image */
  heroImage: HeroImage;
  /** Lead-back CTA pointing at investwithraj.com */
  cta: Cta;
  /** Distribution config */
  distribution: DistributionConfig;
  /** When this insight mirrors a LinkedIn Pulse / newsletter edition,
   *  include the canonical LinkedIn URL — emitted as rel=canonical so
   *  LinkedIn gets the SEO credit, plus surfaces a "Read on LinkedIn" pill. */
  linkedinUrl?: string;
  /** When this insight references the institutional 12-page IWR Notes by
   *  name, include the slug(s) here so we can render related-content links
   *  back to investwithraj.com/notes/[slug]. */
  iwrNotesReferenced?: string[];
  /** Optional speakable JSON-LD selector list */
  speakableSelector?: string[];
  /** Estimated read time in minutes */
  readTimeMin: number;
}

/** Sort: most-recent first */
export function sortInsightArticles(
  articles: InsightArticle[]
): InsightArticle[] {
  return [...articles].sort((a, b) =>
    b.publishedAt.localeCompare(a.publishedAt)
  );
}

/** Insights that have a LinkedIn canonical (i.e. are newsletter mirrors) */
export function getLinkedinMirrors(
  articles: InsightArticle[]
): InsightArticle[] {
  return articles.filter((a) => a.linkedinUrl);
}
