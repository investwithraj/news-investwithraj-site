import type { Metadata } from "next";
import { unstable_cache } from "next/cache";

import NewsArchive from "@/components/redesign/NewsArchive";
import type { NewsArchiveInitialParams } from "@/components/redesign/NewsArchive";
import {
  NEWS_ARCHIVE_DESCRIPTION,
  NEWS_ARCHIVE_PAGE_URL,
  newsArchiveMetadata,
  type NewsArchiveSearchParams,
} from "./metadata";
import { SITE } from "@/lib/constants";
import {
  NEWS_ARCHIVE_FILTER_KEYS,
  newsArchiveFreshness,
} from "@/lib/news-archive";
import {
  NEWS_ARCHIVE_DESKS,
  projectNewsArchiveItems,
} from "@/lib/news-archive-projection";
import { getPublicDiscoveryNewsArticles } from "@/lib/public-content";
import {
  asGraph,
  breadcrumbSchema,
  collectionPageSchemas,
} from "@/lib/schema";

export const revalidate = 3600;

const currentArchiveFreshness = unstable_cache(
  async (newestPublishedAt: string | null) =>
    newsArchiveFreshness(newestPublishedAt, Date.now()),
  ["news-archive-freshness"],
  { revalidate },
);

const PAGE_URL = NEWS_ARCHIVE_PAGE_URL;
const DESCRIPTION = NEWS_ARCHIVE_DESCRIPTION;

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<NewsArchiveSearchParams>;
}): Promise<Metadata> {
  return newsArchiveMetadata(
    await searchParams,
    getPublicDiscoveryNewsArticles().length,
  );
}

type NewsIndexSearchParams = NewsArchiveSearchParams;

function archiveInitialParams(
  values: NewsIndexSearchParams,
): NewsArchiveInitialParams {
  const output: NewsArchiveInitialParams = {};
  for (const key of NEWS_ARCHIVE_FILTER_KEYS) {
    const raw = values[key];
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (typeof value === "string" && value.trim()) {
      output[key] = value.trim().slice(0, key === "q" ? 120 : 80);
    }
  }
  return output;
}

export default async function NewsIndex({
  searchParams,
}: {
  searchParams: Promise<NewsIndexSearchParams>;
}) {
  const live = getPublicDiscoveryNewsArticles();
  const items = projectNewsArchiveItems(live);
  const initialParams = archiveInitialParams(await searchParams);
  const freshness = await currentArchiveFreshness(
    live[0]?.publishedAt ?? null,
  );
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
      <NewsArchive
        items={items}
        desks={NEWS_ARCHIVE_DESKS}
        freshness={freshness}
        initialParams={initialParams}
      />
    </>
  );
}
