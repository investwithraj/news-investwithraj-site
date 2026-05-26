// Closing Bell — 16:30 GST end-of-business-day flash.
// Punchbowl PM / Real Deal Closing Bell pattern. ~150 words, no FAQ, no
// long-form body. Channel-first: drops on Telegram + Discord at 16:30 GST.

export interface ClosingBellArticle {
  /** YYYY-MM-DD-closing-bell slug */
  slug: string;
  /** Headline ≤ 70 chars */
  title: string;
  /** ISO publish time (should be 12:30Z = 16:30 GST) */
  publishedAt: string;
  /** Display date "26 May 2026" */
  displayDate: string;
  /** 3-bullet end-of-day highlights, each ≤ 100 chars */
  highlights: [string, string, string];
  /** 1-2 sentence Raj close — the "what tomorrow looks like" line */
  rajClose: string;
  /** Optional one-line link to a related news article */
  relatedNewsSlug?: string;
}

/** Latest closing bell by date, most recent first. */
export function sortBells(bells: ClosingBellArticle[]): ClosingBellArticle[] {
  return [...bells].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}
