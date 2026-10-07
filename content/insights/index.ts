// Beyond the Deal editions are written and released from the authorised chat
// workflow. The retired external publisher must not populate this registry.

import type { InsightArticle } from "./types";
import { waterfrontBeyondTheView } from "./waterfront-beyond-the-view";
import { paymentPlanNotDiscount } from "./payment-plan-not-discount";
export type { InsightArticle } from "./types";
export {
  sortInsightArticles,
  getLinkedinMirrors,
  type InsightCategory,
} from "./types";

export const INSIGHT_ARTICLES: InsightArticle[] = [paymentPlanNotDiscount, waterfrontBeyondTheView];

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
