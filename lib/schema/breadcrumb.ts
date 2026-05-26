// BreadcrumbList JSON-LD — emitted on every page so Google can render
// proper breadcrumb trails in SERP. Drives rich-result eligibility.

import { SITE } from "@/lib/constants";

export interface Crumb {
  name: string;
  url: string;
}

/** Build a BreadcrumbList schema from an ordered crumb list.
 *  First crumb is always Home — included automatically. */
export function breadcrumbSchema(
  crumbs: Crumb[]
): Record<string, unknown> {
  const items = [
    { name: "Home", url: SITE.url },
    ...crumbs,
  ].map((c, i) => ({
    "@type": "ListItem",
    position: i + 1,
    name: c.name,
    item: c.url,
  }));
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items,
  };
}

/** Common preset trails */
export const BREADCRUMB_PRESETS = {
  news: (article: { slug: string; title: string }): Crumb[] => [
    { name: "News", url: `${SITE.url}/news` },
    { name: article.title, url: `${SITE.url}/news/${article.slug}` },
  ],
  insight: (article: { slug: string; title: string }): Crumb[] => [
    { name: "Insights", url: `${SITE.url}/insights` },
    { name: article.title, url: `${SITE.url}/insights/${article.slug}` },
  ],
  area: (area: { slug: string; name: string }): Crumb[] => [
    { name: "Areas", url: `${SITE.url}/areas` },
    { name: area.name, url: `${SITE.url}/areas/${area.slug}` },
  ],
} as const;
