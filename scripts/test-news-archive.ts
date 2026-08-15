import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { NEWS_ARTICLES } from "@/content/news";
import { planDistinctArticleMedia } from "@/lib/article-display-media";
import {
  archivePageNumber,
  filterNewsArchiveItems,
  NEWS_ARCHIVE_FILTER_KEYS,
  NEWS_ARCHIVE_PAGE_SIZE,
  newsArchiveFreshness,
  normaliseArchiveChoice,
} from "@/lib/news-archive";
import {
  NEWS_ARCHIVE_DESKS,
  projectNewsArchiveItems,
} from "@/lib/news-archive-projection";
import { decisionCta, evidenceSummary } from "@/lib/news-editorial";
import { PUBLISHED_NEWS_ARTICLES } from "@/lib/public-content";
import { getVerticalArticles, VERTICALS } from "@/lib/verticals";

const EXPECTED_DESKS = [
  "dld-pulse",
  "off-plan-watch",
  "uhnw-trades",
  "sovereign-plays",
  "beyond-the-deal",
] as const;
const HOUR_MS = 3_600_000;

const items = projectNewsArchiveItems(NEWS_ARTICLES);
const bySlug = new Map(PUBLISHED_NEWS_ARTICLES.map((article) => [article.slug, article]));

assert.deepEqual(
  NEWS_ARCHIVE_DESKS.map((desk) => desk.slug),
  EXPECTED_DESKS,
  "The archive must expose only the five approved editorial desks.",
);
assert.deepEqual(
  NEWS_ARCHIVE_FILTER_KEYS,
  ["q", "market", "category", "desk", "page"],
  "Only typed article facets and the approved desk model may become filters.",
);
assert.equal(
  items.length,
  PUBLISHED_NEWS_ARTICLES.length,
  "The archive projection must use the complete published boundary.",
);
assert.ok(
  items.every((item, index) =>
    index === 0 || items[index - 1].publishedAt >= item.publishedAt,
  ),
  "Archive items must remain newest-first.",
);
assert.ok(
  items.every((item) => bySlug.has(item.slug)),
  "Research records must not enter the archive projection.",
);

for (const vertical of VERTICALS) {
  const expected = getVerticalArticles(
    vertical,
    PUBLISHED_NEWS_ARTICLES,
  ).map((article) => article.slug);
  const actual = filterNewsArchiveItems(items, {
    query: "",
    market: "all",
    category: "all",
    desk: vertical.slug,
  }).map((item) => item.slug);

  assert.ok(expected.length > 0, `${vertical.name} must remain a usable filter.`);
  assert.deepEqual(
    actual,
    expected,
    `${vertical.name} must use the central articleMatchesVertical contract.`,
  );
}

const target = items.find((item) => item.desks.length > 0);
assert.ok(target, "A published desk article is required for combined-filter tests.");
const combined = filterNewsArchiveItems(items, {
  query: `  ${target.title.toLocaleUpperCase("en")}  `,
  market: target.markets[0],
  category: target.category,
  desk: target.desks[0].slug,
});
assert.ok(
  combined.some((item) => item.slug === target.slug),
  "Query matching must be trimmed, case-insensitive and intersect other facets.",
);
assert.ok(
  combined.every(
    (item) =>
      item.markets.includes(target.markets[0]) &&
      item.category === target.category &&
      item.desks.some((desk) => desk.slug === target.desks[0].slug),
  ),
  "Combined filters must use intersection semantics.",
);

assert.equal(normaliseArchiveChoice(null, EXPECTED_DESKS), "all");
assert.equal(normaliseArchiveChoice("unknown", EXPECTED_DESKS), "all");
assert.equal(
  normaliseArchiveChoice("dld-pulse", EXPECTED_DESKS),
  "dld-pulse",
);

assert.equal(archivePageNumber(Number.NaN, 30), 1);
assert.equal(archivePageNumber(-3, 30), 1);
assert.equal(archivePageNumber(2.9, 30), 2);
assert.equal(archivePageNumber(99, 30), 3);
assert.equal(archivePageNumber(9, 0), 1);
assert.equal(
  archivePageNumber(4, NEWS_ARCHIVE_PAGE_SIZE + 1),
  2,
  "Overflow pages must clamp to the final page.",
);

const publishedAt = "2026-08-13T00:00:00.000Z";
const publishedMs = Date.parse(publishedAt);
assert.deepEqual(newsArchiveFreshness(null, publishedMs), {
  state: "empty",
  newestPublishedAt: null,
  ageHours: null,
  thresholdHours: 48,
});
assert.equal(
  newsArchiveFreshness(publishedAt, publishedMs + 48 * HOUR_MS).state,
  "fresh",
  "The existing 48-hour freshness boundary is inclusive.",
);
assert.equal(
  newsArchiveFreshness(publishedAt, publishedMs + 49 * HOUR_MS).state,
  "stale",
);
assert.equal(
  newsArchiveFreshness(publishedAt, publishedMs - HOUR_MS).ageHours,
  0,
  "Future clock skew must not produce a negative age.",
);
assert.equal(
  newsArchiveFreshness("not-a-date", publishedMs).state,
  "empty",
);

const mediaPlan = planDistinctArticleMedia(PUBLISHED_NEWS_ARTICLES);
for (const item of items) {
  const article = bySlug.get(item.slug);
  assert.ok(article);
  const evidence = evidenceSummary(article);
  const cta = decisionCta(article);
  const plannedMedia = mediaPlan.get(item.slug);

  assert.equal(item.evidenceLabel, evidence.label);
  assert.equal(item.evidenceLimited, evidence.limited);
  assert.deepEqual(item.decisionCta, { href: cta.href, label: cta.label });
  assert.deepEqual(
    item.media,
    plannedMedia?.label === "Report image" ? plannedMedia : null,
    "Archive media must pass the exact approved report-image gate.",
  );
  assert.ok(
    item.media === null || item.media.label === "Report image",
    "Context-only area/developer assets cannot be presented as report imagery.",
  );
  assert.equal("areaSlugs" in item, false);
  assert.equal("developerSlugs" in item, false);

  for (const link of item.advisoryLinks) {
    const url = new URL(link.href);
    assert.equal(url.hostname, "investwithraj.com");
    assert.equal(url.searchParams.get("utm_source"), "news.investwithraj.com");
    assert.equal(url.searchParams.get("utm_medium"), "editorial");
  }
}

const pageSource = readFileSync(resolve("app/news/page.tsx"), "utf8");
const componentSource = readFileSync(
  resolve("components/redesign/NewsArchive.tsx"),
  "utf8",
);
assert.ok(
  pageSource.includes('const PAGE_URL = `${SITE.url}/news`;'),
  "The canonical archive URL must stay rooted at /news.",
);
assert.ok(
  pageSource.includes("canonical: PAGE_URL"),
  "Every client-side filter state must retain the /news canonical.",
);
assert.equal(
  pageSource.includes('dynamic = "force-static"'),
  false,
  "force-static must not blank client useSearchParams in Next 16.",
);
assert.ok(componentSource.includes('searchParams.get("desk")'));
assert.equal(componentSource.includes('searchParams.get("area")'), false);
assert.equal(componentSource.includes('searchParams.get("developer")'), false);
assert.ok(componentSource.includes('data-cta-source="news-archive"'));

console.log(
  `News archive contract passed for ${items.length} reports and ${NEWS_ARCHIVE_DESKS.length} desks.`,
);
