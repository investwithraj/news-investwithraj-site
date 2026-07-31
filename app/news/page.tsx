import type { Metadata } from "next";
import { Suspense } from "react";

import NewsArchive, {
  type NewsArchiveItem,
} from "@/components/redesign/NewsArchive";
import { NEWS_ARTICLES, sortNewsArticles } from "@/content/news";
import { SITE } from "@/lib/constants";
import {
  categoryLabel,
  displayMarkets,
  evidenceSummary,
} from "@/lib/news-editorial";
import {
  asGraph,
  breadcrumbSchema,
  collectionPageSchemas,
} from "@/lib/schema";

export const dynamic = "force-static";
export const revalidate = 3600;

const PAGE_URL = `${SITE.url}/news`;
const DESCRIPTION =
  "The chronological archive of source-linked UAE and Gulf property reporting from Invest With Raj.";

export const metadata: Metadata = {
  title: "News — chronological property intelligence archive",
  description: DESCRIPTION,
  alternates: {
    canonical: PAGE_URL,
    types: { "application/rss+xml": `${SITE.url}/rss.xml` },
  },
};

export default function NewsIndex() {
  const live = sortNewsArticles(NEWS_ARTICLES).filter(
    (article) => article.status !== "research",
  );
  const items: NewsArchiveItem[] = live.map((article) => {
    const evidence = evidenceSummary(article);
    return {
      slug: article.slug,
      title: article.title,
      subtitle: article.subtitle,
      publishedAt: article.publishedAt,
      displayDate: article.displayDate,
      category: article.category,
      categoryLabel: categoryLabel(article.category),
      markets: displayMarkets(article),
      evidenceLabel: evidence.label,
      evidenceLimited: evidence.limited,
    };
  });
  const [collection, itemList] = collectionPageSchemas({
    url: PAGE_URL,
    name: "Invest With Raj news archive",
    description: DESCRIPTION,
    dateModified: live[0]?.modifiedAt,
    itemListOrder: "descending",
    items: live.map((article) => ({
      name: article.title,
      url: `${SITE.url}/news/${article.slug}`,
      description: article.subtitle,
    })),
  });
  const graph = asGraph(
    collection,
    itemList,
    breadcrumbSchema([{ name: "News", url: PAGE_URL }]),
  );

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(graph).replace(/</g, "\\u003c"),
        }}
      />
      <Suspense
        fallback={
          <main
            id="main"
            style={{
              minHeight: "100svh",
              padding: "10rem 8vw",
              background: "#090b10",
              color: "#f0f0ec",
            }}
          >
            Loading the chronological archive…
          </main>
        }
      >
        <NewsArchive items={items} />
      </Suspense>
    </>
  );
}
