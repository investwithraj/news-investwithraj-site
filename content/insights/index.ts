// Central registry of all insight articles. Populated by the Sunday-09:00
// GST weekly routine (Block 2.3) — 1-2 deep-dives per week, PR-reviewed
// before commit. Empty Day-1.

import type { InsightArticle } from "./types";
export type { InsightArticle } from "./types";
export {
  sortInsightArticles,
  getLinkedinMirrors,
  type InsightCategory,
} from "./types";

export const INSIGHT_ARTICLES: InsightArticle[] = [];

export function getLatestInsights(limit = 5): InsightArticle[] {
  return [...INSIGHT_ARTICLES]
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    .slice(0, limit);
}

export function getInsightBySlug(slug: string): InsightArticle | null {
  return INSIGHT_ARTICLES.find((a) => a.slug === slug) ?? null;
}

export function getAllInsightSlugs(): string[] {
  return INSIGHT_ARTICLES.map((a) => a.slug);
}
