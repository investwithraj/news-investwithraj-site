import type { NewsArticle } from "@/content/news/types";
import { areNearDuplicateTitles } from "@/lib/news-editorial";
import { getReleasedNewsroomRedirects } from "@/lib/news-lifecycle";

export const NEWS_DUPLICATE_WINDOW_DAYS = 30 as const;

/**
 * There is deliberately no follow-up escape hatch yet. DraftArticle has no
 * reviewed `updateOf` plus structured material-delta contract, so a purported
 * same-event follow-up must fail closed. Adding that contract later requires
 * evidence-bound fields, validation, approval-ledger coverage and publication
 * tests; `publicationContentHash` remains integrity metadata and never grants
 * editorial permission.
 */
export const MATERIAL_UPDATE_OVERRIDE_SUPPORTED = false as const;

export type NewsDuplicateSignal =
  | "exact-citation-set"
  | "near-duplicate-title";

export interface NewsDuplicateHold {
  signal: NewsDuplicateSignal;
  existingSlug: string;
  existingTitle: string;
  existingPublishedAt: string;
  reason: string;
}

type DuplicateCandidate = Readonly<{
  slug: string;
  title: string;
  citations: ReadonlyArray<{ url: string }>;
}>;

export class NewsDuplicateHoldError extends Error {
  readonly hold: NewsDuplicateHold;

  constructor(hold: NewsDuplicateHold) {
    super(hold.reason);
    this.name = "NewsDuplicateHoldError";
    this.hold = hold;
  }
}

const TRACKING_QUERY_KEYS = new Set([
  "fbclid",
  "gclid",
  "igshid",
  "mc_cid",
  "mc_eid",
  "ref",
  "source",
]);

/** Normalize a reviewed citation URL for order-independent set comparison. */
export function normalizeCanonicalCitationUrl(value: string): string {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return value.trim().toLowerCase();
    }
    url.protocol = "https:";
    url.hostname = url.hostname.toLowerCase().replace(/^www\./u, "");
    if (url.port === "80" || url.port === "443") url.port = "";
    url.hash = "";
    url.pathname =
      url.pathname.replace(/\/{2,}/gu, "/").replace(/\/$/u, "") || "/";
    for (const key of [...url.searchParams.keys()]) {
      const normalizedKey = key.toLowerCase();
      if (
        normalizedKey.startsWith("utm_") ||
        TRACKING_QUERY_KEYS.has(normalizedKey)
      ) {
        url.searchParams.delete(key);
      }
    }
    url.searchParams.sort();
    return url.toString().replace(/\/$/u, "");
  } catch {
    return value.trim().toLowerCase();
  }
}

export function normalizedCitationUrlSet(
  citations: ReadonlyArray<{ url: string }>,
): string[] {
  return [
    ...new Set(
      citations
        .map((citation) => normalizeCanonicalCitationUrl(citation.url))
        .filter(Boolean),
    ),
  ].sort();
}

function sameStringSet(first: readonly string[], second: readonly string[]) {
  return (
    first.length > 0 &&
    first.length === second.length &&
    first.every((value, index) => value === second[index])
  );
}

function releasedRedirectSourceSlugs(): ReadonlySet<string> {
  return new Set(
    getReleasedNewsroomRedirects()
      .map(({ source }) =>
        source.startsWith("/news/") ? source.slice("/news/".length) : "",
      )
      .filter(Boolean),
  );
}

function recentLiveArticles(
  articles: readonly NewsArticle[],
  candidateSlug: string | undefined,
  now: Date,
  windowDays: number,
): NewsArticle[] {
  const cutoff = now.getTime() - windowDays * 24 * 60 * 60 * 1_000;
  const retiredSlugs = releasedRedirectSourceSlugs();
  return articles
    .filter((article) => article.status !== "research")
    // A released redirect source is no longer an editorial comparison record:
    // its canonical survivor is. This lets the survivor be corrected without
    // the retired duplicate blocking it while preserving the guard against a
    // genuinely new third copy.
    .filter((article) => !retiredSlugs.has(article.slug))
    .filter((article) => article.slug !== candidateSlug)
    .filter((article) => {
      const publishedAt = Date.parse(article.publishedAt);
      return Number.isFinite(publishedAt) && publishedAt >= cutoff;
    })
    .sort(
      (first, second) =>
        second.publishedAt.localeCompare(first.publishedAt) ||
        first.slug.localeCompare(second.slug),
    );
}

export function findRecentLiveTitleDuplicate(
  title: string,
  liveArticles: readonly NewsArticle[],
  options: {
    candidateSlug?: string;
    now?: Date;
    windowDays?: number;
  } = {},
): NewsDuplicateHold | null {
  const recent = recentLiveArticles(
    liveArticles,
    options.candidateSlug,
    options.now ?? new Date(),
    options.windowDays ?? NEWS_DUPLICATE_WINDOW_DAYS,
  );
  const existing = recent.find((article) =>
    areNearDuplicateTitles(title, article.title),
  );
  return existing
    ? {
        signal: "near-duplicate-title",
        existingSlug: existing.slug,
        existingTitle: existing.title,
        existingPublishedAt: existing.publishedAt,
        reason: `Publication held: the headline is a near-duplicate of ${existing.slug} within the ${options.windowDays ?? NEWS_DUPLICATE_WINDOW_DAYS}-day live-news window.`,
      }
    : null;
}

/**
 * Compare only editorial identity: canonical citation set first, then the
 * exact public-news headline rule. Content hashes are intentionally ignored.
 */
export function findRecentLiveArticleDuplicate(
  candidate: DuplicateCandidate,
  liveArticles: readonly NewsArticle[],
  options: { now?: Date; windowDays?: number } = {},
): NewsDuplicateHold | null {
  const windowDays = options.windowDays ?? NEWS_DUPLICATE_WINDOW_DAYS;
  const recent = recentLiveArticles(
    liveArticles,
    candidate.slug,
    options.now ?? new Date(),
    windowDays,
  );
  const candidateCitations = normalizedCitationUrlSet(candidate.citations);
  const citationMatch = recent.find((article) =>
    sameStringSet(
      candidateCitations,
      normalizedCitationUrlSet(article.citations),
    ),
  );
  if (citationMatch) {
    return {
      signal: "exact-citation-set",
      existingSlug: citationMatch.slug,
      existingTitle: citationMatch.title,
      existingPublishedAt: citationMatch.publishedAt,
      reason: `Publication held: the normalized canonical citation set exactly matches ${citationMatch.slug} within the ${windowDays}-day live-news window.`,
    };
  }
  return findRecentLiveTitleDuplicate(candidate.title, recent, {
    candidateSlug: candidate.slug,
    now: options.now,
    windowDays,
  });
}

export function assertNoRecentLiveArticleDuplicate(
  candidate: DuplicateCandidate,
  liveArticles: readonly NewsArticle[],
  options: { now?: Date; windowDays?: number } = {},
): void {
  const hold = findRecentLiveArticleDuplicate(candidate, liveArticles, options);
  if (hold) throw new NewsDuplicateHoldError(hold);
}

/** Extract the JSON object emitted by serializeArticle without evaluating TS. */
export function parseSerializedNewsArticle(
  source: string,
): NewsArticle | null {
  const marker = /export const article(?::\s*NewsArticle)?\s*=\s*/u.exec(source);
  if (!marker || marker.index === undefined) return null;
  const start = marker.index + marker[0].length;
  const end = source.lastIndexOf(";");
  if (end <= start) return null;
  try {
    const parsed = JSON.parse(source.slice(start, end).trim()) as Partial<NewsArticle>;
    if (
      typeof parsed.slug !== "string" ||
      typeof parsed.title !== "string" ||
      typeof parsed.publishedAt !== "string" ||
      !Array.isArray(parsed.citations) ||
      parsed.citations.some(
        (citation) =>
          !citation ||
          typeof citation !== "object" ||
          typeof (citation as { url?: unknown }).url !== "string",
      )
    ) {
      return null;
    }
    return parsed as NewsArticle;
  } catch {
    return null;
  }
}

/** Registered dated slugs whose calendar day can intersect the rolling window. */
export function recentRegisteredNewsSlugs(
  indexSource: string,
  options: { now?: Date; windowDays?: number; excludeSlug?: string } = {},
): string[] {
  const now = options.now ?? new Date();
  const windowDays = options.windowDays ?? NEWS_DUPLICATE_WINDOW_DAYS;
  const cutoffDate = new Date(
    now.getTime() - windowDays * 24 * 60 * 60 * 1_000,
  )
    .toISOString()
    .slice(0, 10);
  const retiredSlugs = releasedRedirectSourceSlugs();
  const slugs = [...indexSource.matchAll(/from "\.\/(\d{4}-\d{2}-\d{2}-[a-z0-9-]+)";/gu)]
    .map((match) => match[1])
    .filter((slug) => slug !== options.excludeSlug)
    .filter((slug) => !retiredSlugs.has(slug))
    .filter((slug) => slug.slice(0, 10) >= cutoffDate);
  return [...new Set(slugs)].sort();
}
