// Closing Bell is a compact, evidence-led market close format. The model does
// not encode a publication time, weekday schedule or distribution promise.

export interface ClosingBellArticle {
  /** Stable date-led slug for registry use. */
  slug: string;
  /** Concise edition headline. */
  title: string;
  /** ISO publication timestamp. */
  publishedAt: string;
  /** Human-readable publication date. */
  displayDate: string;
  /** Three concise, attributable end-of-day highlights. */
  highlights: [string, string, string];
  /** Raj's clearly labelled interpretation of what deserves attention next. */
  rajClose: string;
  /** Optional related, published news article. */
  relatedNewsSlug?: string;
}

export function sortBells(
  bells: readonly ClosingBellArticle[],
): ClosingBellArticle[] {
  return [...bells].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}
