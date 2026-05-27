// Articles registry for news.investwithraj.com /v16/articles.
//
// Pipeline doc: ~/MEDIA/_CATALOG/V16-NEWS-PIPELINE.md
//
// To publish a new article: create one .ts file per article in this folder,
// import + append to ARTICLES below. Sections allowed:
//   - "Weekly · DLD round-up"
//   - "Monthly · Area deep-dive"
//   - "Monthly · Plot watchlist"
//   - "Ad-hoc · Launch note"
//   - "Quarterly · Cycle read"

export interface Article {
  slug: string;
  title: string;
  dek: string;             // one-line subhead
  section: string;         // pipeline section label
  publishedAt: string;     // "May 27, 2026"
  publishedAtIso: string;  // "2026-05-27"
  readTimeMin: number;
  body: string;            // MDX-lite plain text for now; upgrade to MDX later
  sourcesCited: Array<{ label: string; href: string }>;
  author?: string;
  modifiedAt?: string;
}

/**
 * The registry. Empty at launch — pipeline is set up but no pieces have
 * shipped yet. Articles get added one .ts file at a time as they publish.
 */
export const ARTICLES: Article[] = [];

export function getAllArticles(): Article[] {
  return [...ARTICLES].sort((a, b) =>
    b.publishedAtIso.localeCompare(a.publishedAtIso),
  );
}

export function getArticleBySlug(slug: string): Article | undefined {
  return ARTICLES.find((a) => a.slug === slug);
}
