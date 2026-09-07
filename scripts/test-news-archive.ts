import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { NEWS_ARCHIVE_PAGE_URL } from "@/app/news/metadata";
import { NEWS_ARTICLES } from "@/content/news";
import { planDistinctArticleMedia } from "@/lib/article-display-media";
import {
  ARTICLE_RELATION_RECORDS,
  getArticleRelationRecord,
  resolveArticleRelations,
  validateArticleRelationRecords,
  type ArticleRelationRecord,
} from "@/lib/article-relations";
import { SITE } from "@/lib/constants";
import {
  archivePageNumber,
  filterNewsArchiveItems,
  NEWS_ARCHIVE_FILTER_KEYS,
  NEWS_ARCHIVE_PAGE_SIZE,
  newsArchiveFreshness,
  normaliseArchiveChoice,
  type NewsArchiveFilters,
} from "@/lib/news-archive";
import {
  NEWS_ARCHIVE_DESKS,
  projectNewsArchiveItems,
} from "@/lib/news-archive-projection";
import { decisionCta, evidenceSummary } from "@/lib/news-editorial";
import { PUBLISHED_NEWS_ARTICLES } from "@/lib/public-content";
import {
  newsArticleSchema,
  newsDeskAuthor,
  newsDeskSchema,
  newsOrgRef,
  newsOrgSchema,
} from "@/lib/schema";
import { getVerticalArticles, VERTICALS } from "@/lib/verticals";

const EXPECTED_DESKS = [
  "dld-pulse",
  "off-plan-watch",
  "uhnw-trades",
  "sovereign-plays",
  "beyond-the-deal",
] as const;
const ALL_FILTERS: NewsArchiveFilters = {
  query: "",
  market: "all",
  category: "all",
  desk: "all",
  area: "all",
  developer: "all",
};
const HOUR_MS = 3_600_000;

const items = projectNewsArchiveItems(NEWS_ARTICLES);
const bySlug = new Map(
  PUBLISHED_NEWS_ARTICLES.map((article) => [article.slug, article]),
);
const relationSlugs = ARTICLE_RELATION_RECORDS.map(
  (record) => record.articleSlug,
);
const publishedSlugs = PUBLISHED_NEWS_ARTICLES.map((article) => article.slug);

assert.deepEqual(
  NEWS_ARCHIVE_DESKS.map((desk) => desk.slug),
  EXPECTED_DESKS,
  "The archive must expose only the five approved editorial desks.",
);
assert.deepEqual(
  NEWS_ARCHIVE_FILTER_KEYS,
  ["q", "market", "category", "desk", "area", "developer", "page"],
  "Only typed article facets and approved editorial relations may filter.",
);
assert.equal(
  items.length,
  PUBLISHED_NEWS_ARTICLES.length,
  "The archive projection must use the complete published boundary.",
);
assert.ok(
  items.every(
    (item, index) =>
      index === 0 || items[index - 1].publishedAt >= item.publishedAt,
  ),
  "Archive items must remain newest-first.",
);
assert.ok(
  items.every((item) => bySlug.has(item.slug)),
  "Research records must not enter the archive projection.",
);

assert.equal(
  new Set(relationSlugs).size,
  ARTICLE_RELATION_RECORDS.length,
  "Published articles must not have duplicate relation records.",
);
assert.deepEqual(
  [...relationSlugs].sort(),
  [...publishedSlugs].sort(),
  "Every published slug must have exactly one explicit relation record.",
);
assert.ok(
  ARTICLE_RELATION_RECORDS.every(
    (record) =>
      Array.isArray(record.areaSlugs) &&
      Array.isArray(record.developerSlugs),
  ),
  "Empty relation arrays are required classifications, not missing data.",
);
validateArticleRelationRecords(ARTICLE_RELATION_RECORDS);

assert.throws(
  () => getArticleRelationRecord("not-a-published-article"),
  /Unknown published article relation/,
);
assert.throws(
  () =>
    validateArticleRelationRecords([
      {
        articleSlug: "not-a-published-article",
        areaSlugs: [],
        developerSlugs: [],
      },
      ...ARTICLE_RELATION_RECORDS,
    ]),
  /Unknown published article relation/,
);
assert.throws(
  () =>
    validateArticleRelationRecords([
      ...ARTICLE_RELATION_RECORDS,
      ARTICLE_RELATION_RECORDS[0],
    ]),
  /Duplicate article relation/,
);
assert.throws(
  () => validateArticleRelationRecords(ARTICLE_RELATION_RECORDS.slice(1)),
  /Missing explicit article relations/,
);

function replaceFirstRelation(
  replacement: Partial<ArticleRelationRecord>,
): ArticleRelationRecord[] {
  return ARTICLE_RELATION_RECORDS.map((record, index) =>
    index === 0 ? { ...record, ...replacement } : record,
  );
}

assert.throws(
  () =>
    validateArticleRelationRecords(
      replaceFirstRelation({ areaSlugs: ["not-an-area"] }),
    ),
  /Unknown advisory area relation/,
);
assert.throws(
  () =>
    validateArticleRelationRecords(
      replaceFirstRelation({ areaSlugs: ["business-bay"] }),
    ),
  /Area relation has no canonical advisory destination/,
);
assert.throws(
  () =>
    validateArticleRelationRecords(
      replaceFirstRelation({ developerSlugs: ["not-a-developer"] }),
    ),
  /Unknown advisory developer relation/,
);
assert.throws(
  () =>
    validateArticleRelationRecords(
      replaceFirstRelation({ developerSlugs: ["damac"] }),
    ),
  /Developer relation has no canonical advisory destination/,
);

for (const vertical of VERTICALS) {
  const expected = getVerticalArticles(
    vertical,
    PUBLISHED_NEWS_ARTICLES,
  ).map((article) => article.slug);
  const actual = filterNewsArchiveItems(items, {
    ...ALL_FILTERS,
    desk: vertical.slug,
  }).map((item) => item.slug);

  assert.ok(expected.length > 0, `${vertical.name} must remain a usable filter.`);
  assert.deepEqual(
    actual,
    expected,
    `${vertical.name} must use the central articleMatchesVertical contract.`,
  );
}

const relatedAreaSlugs = [
  ...new Set(ARTICLE_RELATION_RECORDS.flatMap((record) => record.areaSlugs)),
];
const relatedDeveloperSlugs = [
  ...new Set(
    ARTICLE_RELATION_RECORDS.flatMap((record) => record.developerSlugs),
  ),
];

for (const areaSlug of relatedAreaSlugs) {
  const expected = ARTICLE_RELATION_RECORDS.filter((record) =>
    (record.areaSlugs as readonly string[]).includes(areaSlug),
  )
    .map((record) => record.articleSlug)
    .sort();
  const actual = filterNewsArchiveItems(items, {
    ...ALL_FILTERS,
    area: areaSlug,
  })
    .map((item) => item.slug)
    .sort();

  assert.deepEqual(
    actual,
    expected,
    `${areaSlug} filter count must equal the explicit relation registry.`,
  );
}

for (const developerSlug of relatedDeveloperSlugs) {
  const expected = ARTICLE_RELATION_RECORDS.filter((record) =>
    (record.developerSlugs as readonly string[]).includes(developerSlug),
  )
    .map((record) => record.articleSlug)
    .sort();
  const actual = filterNewsArchiveItems(items, {
    ...ALL_FILTERS,
    developer: developerSlug,
  })
    .map((item) => item.slug)
    .sort();

  assert.deepEqual(
    actual,
    expected,
    `${developerSlug} filter count must equal the explicit relation registry.`,
  );
}

const target = items.find(
  (item) =>
    item.desks.length > 0 &&
    item.areas.length > 0 &&
    item.developers.length > 0,
);
assert.ok(target, "A fully related article is required for intersection tests.");
const combined = filterNewsArchiveItems(items, {
  query: `  ${target.title.toLocaleUpperCase("en")}  `,
  market: target.markets[0],
  category: target.category,
  desk: target.desks[0].slug,
  area: target.areas[0].slug,
  developer: target.developers[0].slug,
});
assert.ok(
  combined.some((item) => item.slug === target.slug),
  "Query matching must be trimmed, case-insensitive and intersect all facets.",
);
assert.ok(
  combined.every(
    (item) =>
      item.markets.includes(target.markets[0]) &&
      item.category === target.category &&
      item.desks.some((desk) => desk.slug === target.desks[0].slug) &&
      item.areas.some((area) => area.slug === target.areas[0].slug) &&
      item.developers.some(
        (developer) => developer.slug === target.developers[0].slug,
      ),
  ),
  "Combined filters must use intersection semantics.",
);

assert.deepEqual(
  getArticleRelationRecord(
    "2026-06-10-cbd-and-dubai-holding-real-estate-launch-aed-157-9bn-backed-",
  ).developerSlugs,
  [],
  "Nakheel must not be related merely because body text mentions it.",
);
assert.deepEqual(
  getArticleRelationRecord(
    "2026-07-09-modon-and-adib-launch-75-off-plan-financing-for-abu-dhabi-co",
  ).areaSlugs,
  [],
  "Contextual Hudayriyat imagery must not create an area relation.",
);

assert.equal(normaliseArchiveChoice(null, EXPECTED_DESKS), "all");
assert.equal(
  normaliseArchiveChoice("unknown", EXPECTED_DESKS),
  "unknown",
  "Unsupported filters must remain visible and produce an honest zero-state.",
);
assert.equal(
  normaliseArchiveChoice("dld-pulse", EXPECTED_DESKS),
  "dld-pulse",
);
assert.equal(
  filterNewsArchiveItems(items, {
    ...ALL_FILTERS,
    area: normaliseArchiveChoice("unsupported-area", relatedAreaSlugs),
  }).length,
  0,
  "An unsupported area query must not silently widen to all reports.",
);
assert.equal(
  filterNewsArchiveItems(items, {
    ...ALL_FILTERS,
    developer: normaliseArchiveChoice(
      "unsupported-developer",
      relatedDeveloperSlugs,
    ),
  }).length,
  0,
  "An unsupported developer query must not silently widen to all reports.",
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
  const relations = resolveArticleRelations(item.slug);
  const relationLinks = [
    ...relations.areas.flatMap((area) => area.advisoryLinks),
    ...relations.developers.map((developer) => developer.advisoryLink),
  ];
  const expectedLinks = [
    ...new Map(relationLinks.map((link) => [link.href, link])).values(),
  ].slice(0, 2);

  assert.equal(item.evidenceLabel, evidence.label);
  assert.equal(item.evidenceLimited, evidence.limited);
  assert.deepEqual(item.decisionCta, { href: cta.href, label: cta.label });
  assert.deepEqual(
    item.media,
    plannedMedia?.label === "Report image" ? plannedMedia : null,
    "Archive media must pass the exact approved report-image gate.",
  );
  assert.deepEqual(
    item.areas,
    relations.areas.map(({ slug, name }) => ({ slug, name })),
  );
  assert.deepEqual(
    item.developers,
    relations.developers.map(({ slug, name }) => ({ slug, name })),
  );
  assert.deepEqual(
    item.advisoryLinks,
    expectedLinks,
    "Dossier links must come from the same explicit relation record as filters.",
  );
  assert.ok(
    item.media === null || item.media.label === "Report image",
    "Context-only area/developer assets cannot be presented as report imagery.",
  );

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
const projectionSource = readFileSync(
  resolve("lib/news-archive-projection.ts"),
  "utf8",
);
const relationsSource = readFileSync(
  resolve("lib/article-relations.ts"),
  "utf8",
);
const terminalPageSource = readFileSync(
  resolve("app/terminal/page.tsx"),
  "utf8",
);
const terminalShellSource = readFileSync(
  resolve("components/terminal/TerminalShell.tsx"),
  "utf8",
);
const articleComponentSource = readFileSync(
  resolve("components/redesign/NewsArticle.tsx"),
  "utf8",
);
assert.equal(
  NEWS_ARCHIVE_PAGE_URL,
  `${SITE.url}/news`,
  "The canonical archive URL must stay rooted at /news.",
);
assert.ok(pageSource.includes("const PAGE_URL = NEWS_ARCHIVE_PAGE_URL"));
assert.ok(
  pageSource.includes("newsArchiveMetadata("),
  "Archive metadata must apply the tested canonical policy.",
);
assert.equal(
  pageSource.includes('dynamic = "force-static"'),
  false,
  "force-static must not freeze the request-time archive query in Next 16.",
);
assert.ok(
  pageSource.includes("searchParams: Promise<NewsIndexSearchParams>"),
  "The archive page must read request search params on the server.",
);
assert.equal(
  componentSource.includes("useSearchParams"),
  false,
  "The archive body must remain present in initial server-rendered HTML.",
);
assert.ok(componentSource.includes("initialParams"));
assert.ok(componentSource.includes('searchParams.get("desk")'));
assert.ok(componentSource.includes('searchParams.get("area")'));
assert.ok(componentSource.includes('searchParams.get("developer")'));
assert.ok(componentSource.includes('data-cta-source="news-archive"'));
assert.ok(
  componentSource.includes("new URLSearchParams(searchParams)"),
  "Archive page links must start with the complete active filter query.",
);
assert.ok(
  componentSource.includes('params.set("page", String(page))'),
  "Archive page links must change only the page parameter.",
);
assert.ok(
  componentSource.includes("href={archivePageHref(currentPage - 1)}") &&
    componentSource.includes('rel="prev"'),
  "The previous archive page must be an SSR-visible Next Link anchor.",
);
assert.ok(
  componentSource.includes("href={archivePageHref(currentPage + 1)}") &&
    componentSource.includes('rel="next"'),
  "The next archive page must be an SSR-visible Next Link anchor.",
);
assert.equal(
  componentSource.includes("replaceParams({ page: String(currentPage"),
  false,
  "Pagination must not remain dependent on click-only router updates.",
);
assert.ok(
  articleComponentSource.includes(
    'className={`${styles.tldr} article-tldr`}',
  ),
  "The visible summary must expose the stable article-tldr hook.",
);
assert.ok(
  articleComponentSource.includes(
    'className={`${styles.body} article-body`}',
  ),
  "The visible report body must expose the stable article-body hook.",
);
assert.ok(
  terminalPageSource.includes("projectNewsArchiveItems(publicArticles)"),
  "Terminal area shortcuts must be derived from the same archive projection.",
);
assert.ok(
  terminalShellSource.includes('href={`/news?area=${area.slug}`}'),
  "Terminal area shortcuts must target the typed archive filter.",
);

for (const forbidden of [
  "relatedAreasForArticle",
  "relatedDevelopersForArticle",
  "articleMentionsArea",
  "articleMentionsDeveloper",
  "PUBLIC_AREAS",
  "PUBLIC_DEVELOPERS",
]) {
  assert.equal(
    projectionSource.includes(forbidden),
    false,
    `Archive projection must not use inferred relation helper ${forbidden}.`,
  );
  assert.equal(
    relationsSource.includes(forbidden),
    false,
    `Explicit relation registry must not use inferred helper ${forbidden}.`,
  );
}

const representativeArticle = PUBLISHED_NEWS_ARTICLES[0];
assert.ok(
  representativeArticle,
  "One published article is required for schema checks.",
);
const representativeSchema = newsArticleSchema(representativeArticle);
assert.deepEqual(
  representativeSchema.author,
  newsDeskAuthor,
  "News reports must identify the visible News Desk as the author.",
);
assert.deepEqual(
  representativeSchema.publisher,
  newsOrgRef,
  "The publication must remain the NewsMediaOrganization publisher.",
);
assert.equal(newsDeskSchema["@type"], "Organization");
assert.equal(
  newsDeskSchema.url,
  `${SITE.url}/about/editorial-standards`,
  "The collective byline must resolve to its public editorial standards page.",
);
assert.equal(newsOrgSchema["@type"], "NewsMediaOrganization");
assert.equal(
  "diversityPolicy" in newsOrgSchema,
  false,
  "The publisher must not claim a diversity policy that is not published.",
);

for (const article of PUBLISHED_NEWS_ARTICLES) {
  for (const selector of article.speakableSelector ?? []) {
    assert.ok(
      selector.startsWith(".article-tldr") ||
        selector.startsWith(".article-body"),
      `${article.slug} speakable selector must target a stable live DOM hook.`,
    );
  }
}

console.log(
  `News archive contract passed for ${items.length} reports, ${NEWS_ARCHIVE_DESKS.length} desks, ${relatedAreaSlugs.length} areas and ${relatedDeveloperSlugs.length} developers.`,
);
