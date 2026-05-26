// Closing Bell registry. Empty Day-1 — daily 16:30 GST cron writes here.

import type { ClosingBellArticle } from "./types";
export type { ClosingBellArticle } from "./types";
export { sortBells } from "./types";

export const CLOSING_BELLS: ClosingBellArticle[] = [];

export function getLatestBells(limit = 10): ClosingBellArticle[] {
  return [...CLOSING_BELLS]
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    .slice(0, limit);
}

export function getBellBySlug(slug: string): ClosingBellArticle | null {
  return CLOSING_BELLS.find((b) => b.slug === slug) ?? null;
}

export function getAllBellSlugs(): string[] {
  return CLOSING_BELLS.map((b) => b.slug);
}
