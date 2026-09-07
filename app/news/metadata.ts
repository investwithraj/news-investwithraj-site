import type { Metadata } from "next";

import { SITE } from "@/lib/constants";
import { NEWS_ARCHIVE_PAGE_SIZE } from "@/lib/news-archive";

export const NEWS_ARCHIVE_PAGE_URL = `${SITE.url}/news`;
export const NEWS_ARCHIVE_DESCRIPTION =
  "The chronological archive of source-linked UAE and Gulf real estate reporting from Invest With Raj Intelligence.";
export const NEWS_ARCHIVE_TITLE =
  "News — chronological real estate intelligence archive";

export type NewsArchiveSearchParams = Record<
  string,
  string | string[] | undefined
>;

export function newsArchiveCanonical(
  values: NewsArchiveSearchParams,
  itemCount: number,
): Readonly<{ url: string; page: number | null }> {
  if (Object.keys(values).length !== 1) {
    return { url: NEWS_ARCHIVE_PAGE_URL, page: null };
  }

  const rawPage = values.page;
  if (typeof rawPage !== "string" || !/^[1-9]\d*$/.test(rawPage)) {
    return { url: NEWS_ARCHIVE_PAGE_URL, page: null };
  }

  const page = Number(rawPage);
  const pageCount = Math.max(
    1,
    Math.ceil(Math.max(0, itemCount) / NEWS_ARCHIVE_PAGE_SIZE),
  );
  if (!Number.isSafeInteger(page) || page <= 1 || page > pageCount) {
    return { url: NEWS_ARCHIVE_PAGE_URL, page: null };
  }

  return {
    url: `${NEWS_ARCHIVE_PAGE_URL}?page=${page}`,
    page,
  };
}

export function newsArchiveMetadata(
  values: NewsArchiveSearchParams,
  itemCount: number,
): Metadata {
  const canonical = newsArchiveCanonical(values, itemCount);
  const title = canonical.page
    ? `News archive — page ${canonical.page}`
    : NEWS_ARCHIVE_TITLE;
  const socialTitle = canonical.page
    ? `UAE real estate news archive — Page ${canonical.page}`
    : "UAE real estate news archive";

  return {
    title,
    description: NEWS_ARCHIVE_DESCRIPTION,
    alternates: {
      canonical: canonical.url,
      types: { "application/rss+xml": `${SITE.url}/rss.xml` },
    },
    openGraph: {
      type: "website",
      locale: "en_AE",
      siteName: SITE.name,
      url: canonical.url,
      title: socialTitle,
      description: NEWS_ARCHIVE_DESCRIPTION,
      images: [
        {
          url: `${SITE.url}/api/og`,
          width: 1200,
          height: 630,
          alt: `UAE real estate news archive — ${SITE.name}`,
        },
      ],
    },
  };
}
