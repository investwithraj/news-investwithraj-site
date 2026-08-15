import type { ArticleDisplayMedia } from "@/lib/article-display-media";
import type { VerticalSlug } from "@/lib/verticals";

export const NEWS_ARCHIVE_PAGE_SIZE = 12;
export const NEWS_ARCHIVE_FILTER_KEYS = [
  "q",
  "market",
  "category",
  "desk",
  "area",
  "developer",
  "page",
] as const;

export type NewsArchiveDesk = Readonly<{
  slug: VerticalSlug;
  name: string;
  description: string;
}>;

export type NewsArchiveAdvisoryLink = Readonly<{
  href: string;
  label: string;
  eyebrow: string;
}>;

export type NewsArchiveEntity = Readonly<{
  slug: string;
  name: string;
}>;

export type NewsArchiveItem = Readonly<{
  slug: string;
  title: string;
  subtitle: string;
  publishedAt: string;
  displayDate: string;
  category: string;
  categoryLabel: string;
  markets: string[];
  desks: ReadonlyArray<Pick<NewsArchiveDesk, "slug" | "name">>;
  areas: readonly NewsArchiveEntity[];
  developers: readonly NewsArchiveEntity[];
  evidenceLabel: string;
  evidenceLimited: boolean;
  media: ArticleDisplayMedia | null;
  advisoryLinks: NewsArchiveAdvisoryLink[];
  decisionCta: Readonly<{
    href: string;
    label: string;
  }>;
}>;

export type NewsArchiveFilters = Readonly<{
  query: string;
  market: string;
  category: string;
  desk: string;
  area: string;
  developer: string;
}>;

export type NewsArchiveFreshness = Readonly<{
  state: "empty" | "fresh" | "stale";
  newestPublishedAt: string | null;
  ageHours: number | null;
  thresholdHours: 48;
}>;

const HOUR_MS = 3_600_000;
const FRESH_WINDOW_HOURS = 48;

export function normaliseArchiveChoice(
  value: string | null,
  supported: readonly string[],
): string {
  return value && supported.includes(value) ? value : "all";
}

export function filterNewsArchiveItems(
  items: readonly NewsArchiveItem[],
  filters: NewsArchiveFilters,
): NewsArchiveItem[] {
  const needle = filters.query.trim().toLocaleLowerCase("en");

  return items.filter((item) => {
    const matchesQuery =
      !needle ||
      [
        item.title,
        item.subtitle,
        item.categoryLabel,
        ...item.markets,
        ...item.desks.map((desk) => desk.name),
        ...item.areas.map((area) => area.name),
        ...item.developers.map((developer) => developer.name),
      ]
        .join(" ")
        .toLocaleLowerCase("en")
        .includes(needle);
    const matchesMarket =
      filters.market === "all" || item.markets.includes(filters.market);
    const matchesCategory =
      filters.category === "all" || item.category === filters.category;
    const matchesDesk =
      filters.desk === "all" ||
      item.desks.some((desk) => desk.slug === filters.desk);
    const matchesArea =
      filters.area === "all" ||
      item.areas.some((area) => area.slug === filters.area);
    const matchesDeveloper =
      filters.developer === "all" ||
      item.developers.some(
        (developer) => developer.slug === filters.developer,
      );

    return (
      matchesQuery &&
      matchesMarket &&
      matchesCategory &&
      matchesDesk &&
      matchesArea &&
      matchesDeveloper
    );
  });
}

export function archivePageNumber(
  requestedPage: number,
  itemCount: number,
  pageSize = NEWS_ARCHIVE_PAGE_SIZE,
): number {
  const pageCount = Math.max(1, Math.ceil(itemCount / pageSize));
  return Number.isFinite(requestedPage)
    ? Math.min(Math.max(1, Math.floor(requestedPage)), pageCount)
    : 1;
}

export function newsArchiveFreshness(
  newestPublishedAt: string | null,
  nowMs: number,
): NewsArchiveFreshness {
  const newestTime = newestPublishedAt
    ? new Date(newestPublishedAt).getTime()
    : Number.NaN;
  const ageMs = Number.isFinite(newestTime)
    ? Math.max(0, nowMs - newestTime)
    : null;

  return {
    state:
      ageMs === null
        ? "empty"
        : ageMs <= FRESH_WINDOW_HOURS * HOUR_MS
          ? "fresh"
          : "stale",
    newestPublishedAt: ageMs === null ? null : newestPublishedAt,
    ageHours: ageMs === null ? null : Math.round(ageMs / HOUR_MS),
    thresholdHours: FRESH_WINDOW_HOURS,
  };
}
