import type { NewsArticle } from "@/content/news/types";
import { selectDistinctArticles } from "@/lib/news-editorial";
import {
  getNewsroomLifecycle,
  isNewsroomLifecycleCutoverEnabled,
  isIndexEligibleArticleSlug,
  isReleasedIndexEligiblePath,
} from "@/lib/news-lifecycle";
import {
  getPublicDiscoveryNewsArticles,
  isNewsroomEvidenceHeldArticleSlug,
  isPublicDiscoveryNewsArticleSlug,
} from "@/lib/public-content";

/**
 * One indexability decision shared by metadata, schema, archive, sitemaps and
 * feeds. Newly published additive articles are indexable even before the
 * legacy lifecycle cutover; explicit legacy dispositions still follow the
 * released matrix.
 */
function isIndexableCandidate(slug: string): boolean {
  if (
    !isPublicDiscoveryNewsArticleSlug(slug) ||
    isNewsroomEvidenceHeldArticleSlug(slug)
  ) {
    return false;
  }

  const pathname = `/news/${slug}`;
  const explicitLifecycle = getNewsroomLifecycle(pathname);
  return explicitLifecycle
    ? isReleasedIndexEligiblePath(pathname)
    : isIndexEligibleArticleSlug(slug);
}

export function getIndexablePublicNewsArticles(): NewsArticle[] {
  const candidates = getPublicDiscoveryNewsArticles().filter((article) =>
    isIndexableCandidate(article.slug),
  );
  return isNewsroomLifecycleCutoverEnabled()
    ? candidates
    : selectDistinctArticles(candidates, candidates.length);
}

export function isIndexablePublicNewsArticleSlug(slug: string): boolean {
  return getIndexablePublicNewsArticles().some(
    (article) => article.slug === slug,
  );
}
