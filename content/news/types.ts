// News article schema — what every /news/[slug] page is.
// Daily cron drafts 5-15 of these per day from the verified-source
// whitelist, validates against the Voice Profile, and commits.

import type { SourceTier } from "@/lib/sources/registry";

export type NewsCategory =
  | "market-pulse"        // DLD transaction prints, monthly volume reads
  | "launch"              // new project launches (Modon / Nakheel / Emaar / Aldar / Damac / Sobha)
  | "regulatory"          // RERA / DLD / CBUAE bulletins
  | "macro"               // GCC / UAE economic backdrop affecting RE
  | "developer-corporate" // ADX/DFM-listed developer earnings, M&A, leadership
  | "infrastructure"      // metro extensions, airport expansions, master-plan moves
  | "policy";             // Golden Visa, off-plan rule changes, fee changes

export interface Citation {
  /** Display name of the source */
  source: string;
  /** Canonical article URL */
  url: string;
  /** ISO timestamp when we pulled the source */
  accessedAt: string;
  /** Optional source tier — populated if matched to lib/sources/registry */
  tier?: SourceTier;
}

export interface HeroImage {
  /** Path under /public OR external URL */
  src: string;
  /** Required alt text */
  alt: string;
  /** Photo credit / caption (e.g. "Modon" / "Nakheel" / "DLD" / "Unsplash — Photographer Name") */
  credit: string;
}

export interface Cta {
  /** UTM-tagged URL pointing back to investwithraj.com (use rootCtaUrl helper) */
  href: string;
  label: string;
}

export interface DistributionConfig {
  /** Postiz MCP channel toggles */
  postiz?: {
    linkedin?: boolean;
    x?: boolean;
    fb?: boolean;
    ig?: boolean;
    threads?: boolean;
    tiktok?: boolean;
    pinterest?: boolean;
    bluesky?: boolean;
    mastodon?: boolean;
    youtube?: boolean;
  };
  /** Canonical-back-to-news repost destinations */
  repost?: {
    medium?: boolean;
    substack?: boolean;
    beehiiv?: boolean;
  };
  /** Direct webhook channels */
  telegram?: boolean;
  discord?: boolean;
}

export interface FaqItem {
  q: string;
  a: string;
}

/** Semaform-style structured perspective from a named source / stakeholder. */
export interface ViewFrom {
  /** Who's speaking — "Modon", "Knight Frank", "DLD spokesperson", "Off-plan buyer", etc. */
  source: string;
  /** Optional 1-line role/credential ("VP, Capital Markets") */
  role?: string;
  /** The view itself — 1-3 sentences, plain text */
  view: string;
}

/** Raj's UHNW broker call — what he'd actually do with the news. */
export interface BrokerTake {
  /** Direction — "Buy" | "Watch" | "Avoid" | "Trim" | "Re-rate" */
  action: "Buy" | "Watch" | "Avoid" | "Trim" | "Re-rate" | "Position";
  /** 1-2 sentence reasoning */
  reasoning: string;
  /** Optional time horizon */
  horizon?: string;
}

/**
 * Semaform-style structured article sections. All optional — articles can
 * still ship with just title/tldr/body. When present, the Semaform renderer
 * lays these out as named blocks instead of a flat body.
 */
export interface SemaformSections {
  /** "The Take" — Raj's own POV, 60-120 words */
  theTake?: string;
  /** 2-4 stakeholder perspectives */
  viewsFrom?: ViewFrom[];
  /** "Reality Check" — counter-perspective, 60-120 words */
  realityCheck?: string;
  /** "What Happens Next" — forward-looking, 60-120 words */
  whatHappensNext?: string;
  /** "How I'd Trade It" — Raj's UHNW broker call */
  howIdTradeIt?: BrokerTake;
}

export interface NewsArticle {
  /** URL slug — kebab-case, no leading slash. Used at /news/{slug}. */
  slug: string;
  /** Headline ≤ 90 chars (validator gate 3) */
  title: string;
  /** One-line dek shown under title + in OG description */
  subtitle: string;
  /** ISO publish timestamp (Z) — drives sort, sitemap, NewsArticle JSON-LD */
  publishedAt: string;
  /** Last modified ISO — defaults to publishedAt if unchanged */
  modifiedAt: string;
  /** Display date for cards ("23 May 2026") */
  displayDate: string;
  /** Author — currently always "raj-tomar" (single-byline + AI-assist disclosure) */
  author: "raj-tomar";
  /** Tier — always "news" for this type. Set at the article level for clarity. */
  tier: "news";
  /** Category — drives Notes-like grouping + filter UI */
  category: NewsCategory;
  /** Geographic anchor */
  market: ("Dubai" | "Abu Dhabi" | "Ras Al Khaimah" | "UAE" | "GCC")[];
  /** 3-bullet TLDR shown at top of article body — each ≤ 140 chars */
  tldr: [string, string, string];
  /** Long-form body — paragraphs separated by \n\n (no markdown headers).
   *  Word count target 600–1200 (validator gate 7). */
  body: string;
  /** 3-5 FAQ items appended to article body; also emitted as FAQPage JSON-LD */
  faq: FaqItem[];
  /** ≥1 from lib/sources/registry whitelist (validator gate 5) */
  citations: Citation[];
  /** Hero image */
  heroImage: HeroImage;
  /** UTM-tagged lead-back CTA pointing at investwithraj.com */
  cta: Cta;
  /** Distribution toggles for Postiz / repost / Telegram / Discord */
  distribution: DistributionConfig;
  /** Optional standalone-article SEO description if subtitle isn't ideal for meta */
  metaDescription?: string;
  /** Optional auto-generated speakable selectors for voice-assistant excerpts */
  speakableSelector?: string[];
  /** Optional Semaform-style structured sections. When present, render via SemaformLayout. */
  semaform?: SemaformSections;
}

/** Sort: most-recent first */
export function sortNewsArticles(articles: NewsArticle[]): NewsArticle[] {
  return [...articles].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}

/** Group by category for category-listing pages */
export function groupByCategory(
  articles: NewsArticle[]
): Record<NewsCategory, NewsArticle[]> {
  const out = {} as Record<NewsCategory, NewsArticle[]>;
  for (const a of articles) {
    if (!out[a.category]) out[a.category] = [];
    out[a.category].push(a);
  }
  return out;
}
