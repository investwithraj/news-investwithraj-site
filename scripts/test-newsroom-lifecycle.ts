import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { GET as getFront } from "@/app/api/front/route";
import { GET as getLlms } from "@/app/llms.txt/route";
import { GET as getNewsSitemap } from "@/app/news-sitemap.xml/route";
import { GET as getRss } from "@/app/rss.xml/route";
import sitemap from "@/app/sitemap";
import { NEWS_ARTICLES } from "@/content/news";
import { SITE } from "@/lib/constants";
import {
  AUXILIARY_NEWSROOM_LIFECYCLE,
  canonicalNewsroomRedirectDestination,
  CURRENT_RELEASE_ALDAR_REDIRECT_DESTINATION,
  CURRENT_RELEASE_ALDAR_REDIRECT_SOURCE,
  CURRENT_RELEASE_NEWSROOM_REDIRECT_SOURCE,
  CURRENT_RELEASE_NEWSROOM_REDIRECT_SOURCES,
  CURRENT_RELEASE_NEWSROOM_REDIRECTS,
  FULL_RELEASE_NEWSROOM_REDIRECTS,
  getReleasedNewsroomRedirects,
  getNewsArticleLifecycle,
  getNewsroomLifecycle,
  isNewsroomLifecycleCutoverEnabled,
  isIndexEligibleArticleSlug,
  isIndexEligibleDisposition,
  isIndexEligiblePath,
  isPublicNoindexPath,
  isReleasedNewsroomRemovalPath,
  isReleasedIndexEligiblePath,
  isRenderableArticleSlug,
  isRenderableLifecyclePath,
  NEWSROOM_EXACT_REDIRECTS,
  NEWSROOM_HELD_REDIRECTS,
  NEWSROOM_LIFECYCLE_CUTOVER_ENV,
  NEWSROOM_RELEASE_REMOVAL_CANDIDATES,
  PRIMARY_NEWSROOM_LIFECYCLE,
  type NewsroomDisposition,
} from "@/lib/news-lifecycle";
import { projectNewsArchiveItems } from "@/lib/news-archive-projection";
import { hasVerifiedEditorialImage } from "@/lib/news-editorial";
import {
  getPublicDiscoveryNewsArticles,
  INDEXABLE_NEWS_ARTICLES,
  PUBLISHED_NEWS_ARTICLES,
} from "@/lib/public-content";
import { VERTICALS } from "@/lib/verticals";
import nextConfig from "../next.config";

type CsvRow = Record<string, string>;
type Redirect = {
  source: string;
  destination: string;
  statusCode?: number;
  permanent?: boolean;
  has?: Array<{ type: string; value?: string }>;
};

const root = process.cwd();
const read = (relativePath: string) =>
  readFileSync(resolve(root, relativePath), "utf8");
const rows = parseCsv(read("docs/migration/news-url-disposition.csv"));
const pinnedProductionEvidencePath = resolve(
  root,
  "docs/migration/advisory-redirect-evidence-2026-08-16.csv",
);
const pinnedProductionRows = parseCsv(
  readFileSync(pinnedProductionEvidencePath, "utf8"),
);
const primaryRows = rows.filter((row) => row.in_sitemap === "yes");
const primaryByUrl = new Map(
  primaryRows.map((row) => [row.current_url, row]),
);
const publishedArticlePaths = PUBLISHED_NEWS_ARTICLES.map(
  (article) => `/news/${article.slug}`,
);
const additivePublishedArticlePaths = publishedArticlePaths.filter(
  (pathname) => !getNewsroomLifecycle(pathname),
);
const additiveIndexableArticlePaths = INDEXABLE_NEWS_ARTICLES.filter(
  (article) => !getNewsroomLifecycle(`/news/${article.slug}`),
).map((article) => `/news/${article.slug}`);
const currentPublicAuthorityPaths = [
  ...new Set([...primaryByUrl.keys(), ...additivePublishedArticlePaths]),
].sort();
const currentReleaseRedirectSources = new Set<string>(
  CURRENT_RELEASE_NEWSROOM_REDIRECT_SOURCES,
);
const currentReleasePublicAuthorityPaths = currentPublicAuthorityPaths.filter(
  (pathname) => !currentReleaseRedirectSources.has(pathname),
);
for (const pathname of additivePublishedArticlePaths) {
  assert.equal(getNewsroomLifecycle(pathname), null);
  assert.deepEqual(
    getNewsArticleLifecycle(pathname.slice("/news/".length)),
    { disposition: "IMPROVE", destination: "self" },
  );
}

const EXPECTED_PRIMARY_COUNTS: Record<string, number> = {
  KEEP: 5,
  IMPROVE: 26,
  MERGE: 10,
  REDIRECT: 21,
  NOINDEX: 12,
  REMOVE: 5,
};
const KNOWN_DISPOSITIONS = new Set<NewsroomDisposition>([
  "KEEP",
  "IMPROVE",
  "MERGE",
  "REDIRECT",
  "NOINDEX",
  "REMOVE",
  "PRIVATE",
]);

const originalCutover = process.env[NEWSROOM_LIFECYCLE_CUTOVER_ENV];
delete process.env[NEWSROOM_LIFECYCLE_CUTOVER_ENV];

assert.equal(isNewsroomLifecycleCutoverEnabled(), false);
assert.equal(
  isNewsroomLifecycleCutoverEnabled({
    [NEWSROOM_LIFECYCLE_CUTOVER_ENV]: "true",
  }),
  false,
  "Only the exact value 1 may activate cutover.",
);
assert.deepEqual(
  getReleasedNewsroomRedirects(),
  CURRENT_RELEASE_NEWSROOM_REDIRECTS,
  "Default release state must expose only the verified duplicate redirect.",
);
assert.deepEqual(CURRENT_RELEASE_NEWSROOM_REDIRECTS, [
  {
    source: CURRENT_RELEASE_NEWSROOM_REDIRECT_SOURCE,
    destination:
      "/news/2026-06-23-dubai-launches-flexi-rent-12-landlords-offer-monthly-instalm",
    statusCode: 301,
  },
  {
    source: CURRENT_RELEASE_ALDAR_REDIRECT_SOURCE,
    destination: CURRENT_RELEASE_ALDAR_REDIRECT_DESTINATION,
    statusCode: 301,
  },
]);
assert.equal(
  getPublicDiscoveryNewsArticles().length,
  PUBLISHED_NEWS_ARTICLES.length - CURRENT_RELEASE_NEWSROOM_REDIRECTS.length,
);
const currentPublicSitemapPaths = sitemap()
  .map((entry) => new URL(entry.url).pathname)
  .sort();
assert.equal(
  currentPublicSitemapPaths.length,
  currentReleasePublicAuthorityPaths.length,
  "Flag-off discovery must exclude only the two released duplicates from the legacy baseline plus reviewed daily publications.",
);
assert.deepEqual(
  currentPublicSitemapPaths,
  currentReleasePublicAuthorityPaths,
  "Flag-off discovery drifted beyond the two released duplicates.",
);
assert.equal(
  isRenderableArticleSlug(
    "2026-07-21-ethiopia-sets-10m-investment-bar-for-golden-visa-18-uae-prop",
  ),
  true,
  "A previously public REMOVE candidate must stay readable before cutover.",
);
assert.equal(isRenderableLifecyclePath("/areas/palm-jumeirah"), true);
assert.equal(isReleasedIndexEligiblePath("/areas/palm-jumeirah"), true);
assert.match(
  read("app/pulse/page.tsx"),
  /if \(isNewsroomLifecycleCutoverEnabled\(\)\) notFound\(\)/,
);

process.env[NEWSROOM_LIFECYCLE_CUTOVER_ENV] = "1";
assert.equal(isNewsroomLifecycleCutoverEnabled(), true);
assert.equal(getReleasedNewsroomRedirects().length, 32);
assert.equal(FULL_RELEASE_NEWSROOM_REDIRECTS.length, 32);
assert.equal(NEWSROOM_EXACT_REDIRECTS.length, 31);
assert.equal(NEWSROOM_RELEASE_REMOVAL_CANDIDATES.length, 6);
assert.deepEqual(
  [...NEWSROOM_RELEASE_REMOVAL_CANDIDATES].sort(),
  [
    "/news/2026-06-22-from-dhoom-to-dubai-how-rimi-sen-traded-bollywood-for-luxury",
    "/news/2026-06-24-oman-tenders-1-035bn-solar-mandate-as-vision-2040-absorbs-1-",
    "/news/2026-06-29-dar-global-launches-19-fendi-casa-villas-at-oman-s-aida-clif",
    "/news/2026-07-12-kuwait-property-deals-fall-13-as-land-fees-and-war-chill-h1-",
    "/news/2026-07-21-ethiopia-sets-10m-investment-bar-for-golden-visa-18-uae-prop",
    "/pulse",
  ],
);
for (const pathname of NEWSROOM_RELEASE_REMOVAL_CANDIDATES) {
  assert.equal(
    isReleasedNewsroomRemovalPath(pathname, {
      [NEWSROOM_LIFECYCLE_CUTOVER_ENV]: "1",
    }),
    true,
  );
  assert.equal(
    isReleasedNewsroomRemovalPath(pathname, {
      [NEWSROOM_LIFECYCLE_CUTOVER_ENV]: "0",
    }),
    false,
  );
}
assert.equal(
  isReleasedNewsroomRemovalPath("/wallet", {
    [NEWSROOM_LIFECYCLE_CUTOVER_ENV]: "1",
  }),
  false,
);
const releasedLegacyPaths = primaryRows
  .filter((row) => row.disposition === "KEEP" || row.disposition === "IMPROVE")
  .map((row) => row.current_url);
const releasedAuthorityPaths = [
  ...new Set([...releasedLegacyPaths, ...additiveIndexableArticlePaths]),
].sort();
assert.equal(
  getPublicDiscoveryNewsArticles().length,
  INDEXABLE_NEWS_ARTICLES.length,
);

assert.equal(rows.length, 130, "The authoritative CSV row count changed.");
assert.equal(primaryRows.length, 79, "The primary sitemap baseline changed.");
assert.equal(
  primaryByUrl.size,
  primaryRows.length,
  "Every primary URL must have exactly one authoritative row.",
);
assert.deepEqual(
  dispositionCounts(primaryRows),
  EXPECTED_PRIMARY_COUNTS,
  "Primary lifecycle counts no longer match the approved disposition.",
);
assert.ok(
  rows.every((row) =>
    KNOWN_DISPOSITIONS.has(row.disposition as NewsroomDisposition),
  ),
  "The CSV contains an unsupported lifecycle disposition.",
);
assert.deepEqual(
  Object.keys(PRIMARY_NEWSROOM_LIFECYCLE).sort(),
  [...primaryByUrl.keys()].sort(),
  "The typed lifecycle mirror must cover the exact 79 primary URLs.",
);

for (const row of primaryRows) {
  const lifecycle = getNewsroomLifecycle(row.current_url);
  assert.ok(lifecycle, `Missing lifecycle state for ${row.current_url}.`);
  assert.equal(
    lifecycle.disposition,
    row.disposition,
    `${row.current_url} disposition drifted from the CSV.`,
  );
  assert.equal(
    lifecycle.destination,
    row.destination,
    `${row.current_url} destination drifted from the CSV.`,
  );
}

const expectedIndexablePaths = primaryRows
  .filter((row) => row.disposition === "KEEP" || row.disposition === "IMPROVE")
  .map((row) => row.current_url)
  .sort();
const actualSitemapPaths = sitemap()
  .map((entry) => new URL(entry.url).pathname)
  .sort();

assert.equal(expectedIndexablePaths.length, 31);
assert.equal(actualSitemapPaths.length, releasedAuthorityPaths.length);
assert.equal(new Set(actualSitemapPaths).size, releasedAuthorityPaths.length);
assert.deepEqual(
  actualSitemapPaths,
  releasedAuthorityPaths,
  "sitemap.xml must be the legacy KEEP + IMPROVE set plus reviewed daily publications.",
);
for (const row of primaryRows) {
  assert.equal(
    actualSitemapPaths.includes(row.current_url),
    row.disposition === "KEEP" || row.disposition === "IMPROVE",
    `${row.current_url} has the wrong sitemap membership.`,
  );
}

assert.ok(NEWS_ARTICLES.length >= 45, "The certified source-record baseline regressed.");
assert.ok(
  PUBLISHED_NEWS_ARTICLES.length >= 41,
  "The certified published-record baseline regressed.",
);
assert.ok(
  NEWS_ARTICLES.filter((article) => article.status === "research").length >= 4,
  "The held research-record baseline regressed.",
);
const expectedIndexableArticleSlugs = releasedAuthorityPaths
  .filter((pathname) => pathname.startsWith("/news/"))
  .map((pathname) => pathname.slice("/news/".length))
  .sort();
assert.equal(
  INDEXABLE_NEWS_ARTICLES.length,
  expectedIndexableArticleSlugs.length,
);
assert.ok(
  PUBLISHED_NEWS_ARTICLES.every((article) =>
    getNewsArticleLifecycle(article.slug),
  ),
  "Every live record needs an explicit legacy or conservative additive lifecycle state.",
);
assert.ok(
  INDEXABLE_NEWS_ARTICLES.every((article) =>
    isIndexEligibleArticleSlug(article.slug),
  ),
);
assert.deepEqual(
  INDEXABLE_NEWS_ARTICLES.map((article) => article.slug).sort(),
  expectedIndexableArticleSlugs,
);

const archiveItems = projectNewsArchiveItems(INDEXABLE_NEWS_ARTICLES);
assert.equal(archiveItems.length, expectedIndexableArticleSlugs.length);
assert.ok(
  archiveItems.every((item) => isIndexEligibleArticleSlug(item.slug)),
  "The archive exposed a retired or noindex article.",
);

const noindexRows = primaryRows.filter(
  (row) => row.disposition === "NOINDEX",
);
assert.equal(noindexRows.length, 12);
for (const row of noindexRows) {
  assert.equal(isPublicNoindexPath(row.current_url), true);
  assert.equal(isIndexEligiblePath(row.current_url), false);
  if (row.scope === "primary-article") {
    assert.equal(
      isRenderableArticleSlug(row.current_url.slice("/news/".length)),
      true,
      `${row.current_url} must remain directly readable.`,
    );
  }
}
assert.equal(
  isPublicNoindexPath("/areas/wynn-al-marjan"),
  true,
  "The blocked Wynn redirect must remain a public noindex route.",
);
assert.equal(
  Object.keys(NEWSROOM_HELD_REDIRECTS).length,
  3,
  "Each matrix redirect discrepancy needs an explicit held record.",
);

assertPublicNoindexMetadataGates();

const removeArticleRows = primaryRows.filter(
  (row) =>
    row.scope === "primary-article" && row.disposition === "REMOVE",
);
assert.equal(removeArticleRows.length, 5);
for (const row of removeArticleRows) {
  const slug = row.current_url.slice("/news/".length);
  assert.equal(isRenderableArticleSlug(slug), false);
  assert.ok(
    PUBLISHED_NEWS_ARTICLES.some((article) => article.slug === slug),
    `${slug} source record was deleted instead of route-gated.`,
  );
}
assert.ok(
  NEWSROOM_RELEASE_REMOVAL_CANDIDATES.includes("/pulse"),
  "/pulse must share the one lifecycle release boundary.",
);

async function main() {
process.env[NEWSROOM_LIFECYCLE_CUTOVER_ENV] = "0";
const currentPublicRedirects = await configuredRedirects();
const currentPublicLifecycleRedirects = currentPublicRedirects.filter(
  ({ source }) => currentReleaseRedirectSources.has(source),
);
assert.deepEqual(
  currentPublicLifecycleRedirects,
  CURRENT_RELEASE_NEWSROOM_REDIRECTS.map(
    ({ source, destination, statusCode }) => ({
      source,
      destination: canonicalNewsroomRedirectDestination(destination),
      statusCode,
    }),
  ),
  "Flag-off configuration must contain only the two verified one-hop duplicate redirects.",
);
process.env[NEWSROOM_LIFECYCLE_CUTOVER_ENV] = "1";
const redirects = await configuredRedirects();
const lifecycleRedirectRows = rows.filter(
  (row) =>
    (row.in_sitemap === "yes" ||
      row.scope === "content-exception" ||
      row.current_url === "/spatial") &&
    (row.disposition === "MERGE" || row.disposition === "REDIRECT"),
);
const redirectBySource = new Map(
  NEWSROOM_EXACT_REDIRECTS.map((redirect) => [redirect.source, redirect]),
);
const configuredRedirectBySource = new Map(
  redirects.map((redirect) => [redirect.source, redirect]),
);

assert.equal(lifecycleRedirectRows.length, 34);
assert.equal(redirectBySource.size, 31);
assert.equal(
  redirects.filter(({ source }) =>
    FULL_RELEASE_NEWSROOM_REDIRECTS.some(
      (candidate) => candidate.source === source,
    ),
  ).length,
  32,
  "Full cutover must configure the frozen 31 legacy redirects plus the additive Aldar redirect.",
);
for (const row of lifecycleRedirectRows) {
  const redirect = redirectBySource.get(row.current_url);
  if (isHeldRedirect(row.current_url)) {
    assert.equal(redirect, undefined);
    assert.equal(
      NEWSROOM_HELD_REDIRECTS[
        row.current_url as keyof typeof NEWSROOM_HELD_REDIRECTS
      ].destination,
      row.destination,
    );
    if (row.current_url === "/areas/wynn-al-marjan") {
      assertPinnedExternalEvidence(row.destination, "noindex, follow");
    }
    continue;
  }
  assert.ok(redirect, `Missing exact redirect for ${row.current_url}.`);
  assert.equal(redirect.destination, row.destination);
  assert.equal(redirect.statusCode, 301);
  assertRedirectDestination(redirect.source, redirect.destination);
  const configured = configuredRedirectBySource.get(row.current_url);
  assert.ok(configured, `Released redirect missing for ${row.current_url}.`);
  assert.equal(
    configured.destination,
    canonicalNewsroomRedirectDestination(row.destination),
  );
}

const fullReleaseSources = new Set(
  FULL_RELEASE_NEWSROOM_REDIRECTS.map(({ source }) => source),
);
for (const { source, destination } of FULL_RELEASE_NEWSROOM_REDIRECTS) {
  const destinationUrl = new URL(destination, SITE.url);
  assert.ok(
    destinationUrl.origin !== SITE.url ||
      !fullReleaseSources.has(destinationUrl.pathname),
    `${source} redirects through another retired newsroom URL.`,
  );
}
for (const redirect of redirects.filter((candidate) =>
  fullReleaseSources.has(candidate.source),
)) {
  assert.ok(
    redirect.destination.startsWith("https://"),
    `${redirect.source} must use an absolute final destination for www one-hop safety.`,
  );
}

assert.ok(
  redirects.some(
    (redirect) =>
      redirect.source === "/:path*" &&
      redirect.has?.some(
        (condition) =>
          condition.type === "host" &&
          condition.value === "www.news.investwithraj.com",
      ),
  ),
  "The www host cutover must remain configured pending external DNS.",
);
for (const redirect of redirects) {
  if (!redirect.source.includes(":path*")) continue;
  assert.ok(
    redirect.has?.some(
      (condition) =>
        condition.type === "host" &&
        condition.value === "www.news.investwithraj.com",
    ),
    `Broad wildcard redirect is forbidden: ${redirect.source}.`,
  );
}
assert.ok(
  read("next.config.ts").includes("currently absent DNS"),
  "The local preview must document that www newsroom DNS is still external.",
);

await assertDiscoveryExclusions();
assertDuplicateResolution();
assertHeldRoutes();
assertNoRetiredPublicHrefs();
assertApprovedCoverPreserved();

if (originalCutover === undefined) {
  delete process.env[NEWSROOM_LIFECYCLE_CUTOVER_ENV];
} else {
  process.env[NEWSROOM_LIFECYCLE_CUTOVER_ENV] = originalCutover;
}

console.log(
  `Newsroom lifecycle PASS: 79-route legacy authority + ${additivePublishedArticlePaths.length} daily publication(s) -> ${releasedAuthorityPaths.length} indexable; ` +
    "12 matrix noindex + 3 held redirects retained, 5 article removals gated, " +
    `31 frozen legacy redirects + 1 additive current redirect, ${PUBLISHED_NEWS_ARTICLES.length} live records preserved, feeds/archive/front clean; ` +
    "two fact-preservation gaps and Wynn target indexability held; www DNS remains external.",
);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

function dispositionCounts(input: CsvRow[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const row of input) {
    counts[row.disposition] = (counts[row.disposition] ?? 0) + 1;
  }
  return Object.fromEntries(
    Object.entries(counts).sort(([left], [right]) => left.localeCompare(right)),
  );
}

function parseCsv(source: string): CsvRow[] {
  const records: string[][] = [];
  let record: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (character === '"') {
      if (quoted && source[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      record.push(field);
      field = "";
    } else if (character === "\n" && !quoted) {
      record.push(field);
      records.push(record);
      record = [];
      field = "";
    } else if (character !== "\r" || quoted) {
      field += character;
    }
  }

  if (field.length > 0 || record.length > 0) {
    record.push(field);
    records.push(record);
  }

  const [headers, ...data] = records;
  assert.ok(headers, "CSV has no header row.");
  return data
    .filter((values) => values.some((value) => value.length > 0))
    .map((values) =>
      Object.fromEntries(
        headers.map((header, index) => [header, values[index] ?? ""]),
      ),
    );
}

function assertPublicNoindexMetadataGates() {
  const articleRoute = read("app/news/[slug]/page.tsx");
  const articleMetadata = read("lib/news-metadata.ts");
  const areaRoute = read("app/areas/[slug]/page.tsx");
  const developerRoute = read("app/developer/[slug]/page.tsx");
  const terminalRoute = read("app/terminal/page.tsx");

  assert.match(
    articleMetadata,
    /index: isIndexablePublicNewsArticleSlug\(article\.slug\)/,
  );
  assert.match(articleMetadata, /follow:\s*true/);
  assert.match(articleRoute, /return newsArticleMetadata\(article\)/);
  assert.match(
    areaRoute,
    /index:\s*isReleasedIndexEligiblePath\(`\/areas\/\$\{slug\}`\)/,
  );
  assert.match(
    developerRoute,
    /index:\s*isReleasedIndexEligiblePath\(`\/developer\/\$\{slug\}`\)/,
  );
  assert.match(
    terminalRoute,
    /index:\s*isReleasedIndexEligiblePath\("\/terminal"\)/,
  );
  assert.match(areaRoute, /const graph = indexEligible/);
  assert.match(developerRoute, /const graph = indexEligible/);
  assert.match(
    terminalRoute,
    /isReleasedIndexEligiblePath\("\/terminal"\) \? <JsonLd \/>/,
  );
  assert.match(articleRoute, /const graph = indexEligible/);
  assert.match(articleRoute, /!isRenderableArticleSlug\(slug\)/);
  assert.match(articleRoute, /notFound\(\)/);
}

async function configuredRedirects(): Promise<Redirect[]> {
  const redirects = nextConfig.redirects;
  if (typeof redirects !== "function") {
    throw new Error("next.config.ts has no redirects function.");
  }
  return (await redirects()) as Redirect[];
}

function assertRedirectDestination(source: string, destination: string) {
  const target = new URL(destination, SITE.url);
  if (target.origin === SITE.url) {
    if (target.pathname === "/news" && target.searchParams.has("desk")) {
      assert.ok(
        VERTICALS.some(
          (vertical) => vertical.slug === target.searchParams.get("desk"),
        ),
        `${source} points to an unsupported desk filter.`,
      );
      return;
    }
    if (target.pathname === "/news") return;

    assert.match(target.pathname, /^\/news\/[^/]+$/);
    const lifecycle = getNewsroomLifecycle(target.pathname);
    assert.ok(lifecycle, `${source} has a missing local destination.`);
    assert.ok(
      isIndexEligibleDisposition(lifecycle.disposition),
      `${source} destination is not canonical/indexable.`,
    );
    assert.ok(
      PUBLISHED_NEWS_ARTICLES.some(
        (article) => `/news/${article.slug}` === target.pathname,
      ),
      `${source} points to a dead article target.`,
    );
    return;
  }

  assert.equal(target.origin, "https://investwithraj.com");
  assert.ok(
    target.pathname.startsWith("/areas/") ||
      target.pathname.startsWith("/developers") ||
      target.pathname.startsWith("/projects/"),
    `${source} points outside the approved advisory dossier families.`,
  );
  assertPinnedExternalEvidence(destination, "index, follow");
}

function assertPinnedExternalEvidence(
  destination: string,
  expectedRobots: "index, follow" | "noindex, follow",
) {
  const evidence = pinnedProductionRows.find(
    (row) =>
      row.source_estate === "advisory" &&
      row.record_kind === "url-observation" &&
      row.request_method === "GET" &&
      row.requested_url === destination,
  );
  assert.ok(evidence, `Pinned production evidence is missing ${destination}.`);
  assert.equal(evidence.status, "200", `${destination} is not a proven 200.`);
  assert.equal(
    evidence.final_url,
    destination,
    `${destination} is not a proven direct destination.`,
  );
  assert.equal(evidence.redirect_count, "0");
  assert.equal(evidence.canonical, destination);
  assert.equal(
    evidence.effective_page_robots,
    expectedRobots,
    `${destination} has the wrong pinned indexability evidence.`,
  );
}

async function assertDiscoveryExclusions() {
  const excludedSlugs = new Set(
    PUBLISHED_NEWS_ARTICLES.filter(
      (article) => !isIndexEligibleArticleSlug(article.slug),
    ).map((article) => article.slug),
  );

  const frontResponse = await getFront();
  const frontPayload = (await frontResponse.json()) as {
    items: Array<{ slug: string }>;
  };
  assert.equal(
    frontResponse.headers.get("X-Robots-Tag"),
    "noindex, nofollow, noarchive",
  );
  assert.ok(
    frontPayload.items.every((item) => !excludedSlugs.has(item.slug)),
    "/api/front exposed a retired or noindex article.",
  );
  assert.ok(
    frontPayload.items.some(
      (item) =>
        item.slug ===
        CURRENT_RELEASE_ALDAR_REDIRECT_DESTINATION.slice("/news/".length),
    ),
    "/api/front failed to restore the corrected Aldar report.",
  );

  const archiveSlugs = projectNewsArchiveItems(
    getPublicDiscoveryNewsArticles(),
  ).map((item) => item.slug);
  assert.ok(
    !archiveSlugs.includes(
      CURRENT_RELEASE_ALDAR_REDIRECT_SOURCE.slice("/news/".length),
    ),
    "The archive exposed the retired Aldar duplicate.",
  );
  assert.ok(
    archiveSlugs.includes(
      CURRENT_RELEASE_ALDAR_REDIRECT_DESTINATION.slice("/news/".length),
    ),
    "The archive failed to restore the corrected Aldar report.",
  );

  const rss = await getRss().text();
  const rssSlugs = [
    ...rss.matchAll(/<guid isPermaLink="true">[^<]*\/news\/([^<]+)<\/guid>/g),
  ].map((match) => match[1]);
  assert.equal(
    rssSlugs.length,
    Math.min(30, INDEXABLE_NEWS_ARTICLES.length),
  );
  assert.ok(rssSlugs.every((slug) => !excludedSlugs.has(slug)));

  const newestTime = new Date(INDEXABLE_NEWS_ARTICLES[0].publishedAt).getTime();
  const originalNow = Date.now;
  Date.now = () => newestTime + 60 * 60 * 1_000;
  try {
    const newsXml = await getNewsSitemap().text();
    const newsSlugs = [
      ...newsXml.matchAll(/<loc>[^<]*\/news\/([^<]+)<\/loc>/g),
    ].map((match) => match[1]);
    assert.ok(newsSlugs.length > 0);
    assert.ok(newsSlugs.every((slug) => !excludedSlugs.has(slug)));
    assert.ok(
      newsSlugs.includes(
        CURRENT_RELEASE_ALDAR_REDIRECT_DESTINATION.slice("/news/".length),
      ),
      "The News sitemap failed to restore the corrected Aldar report.",
    );
  } finally {
    Date.now = originalNow;
  }

  const llms = await getLlms().text();
  assert.ok(!llms.includes(`${SITE.url}/areas:`));
  assert.ok(!llms.includes(`${SITE.url}/developers:`));
  assert.ok(llms.includes(`${SITE.url}/news?area={area-slug}`));
  assert.ok(llms.includes(`${SITE.url}/news?developer={developer-slug}`));
  assert.ok(!llms.includes(`${SITE.url}${CURRENT_RELEASE_ALDAR_REDIRECT_SOURCE}`));
  assert.ok(
    llms.includes(`${SITE.url}${CURRENT_RELEASE_ALDAR_REDIRECT_DESTINATION}`),
  );
}

function assertDuplicateResolution() {
  const duplicatePairs = [
    [
      "/news/2026-06-17-dir-completes-189-villa-delivery-at-danah-bay-as-rak-absorbs",
      "/news/2026-06-17-dir-completes-189-villa-delivery-at-danah-bay-as-rak-gains-i",
    ],
    [
      "/news/2026-07-24-aldar-unveils-aed-100bn-marsa-al-saadiyat-abu-dhabi-s-final-",
      "/news/2026-07-23-aldar-activates-aed-100-bn-marsa-al-saadiyat-saadiyat-island",
    ],
  ] as const;

  for (const [source, destination] of duplicatePairs) {
    const redirect = NEWSROOM_EXACT_REDIRECTS.find(
      (candidate) => candidate.source === source,
    );
    assert.equal(redirect?.destination, destination);
    assert.equal(redirect?.statusCode, 301);
    assert.equal(actualSitemapPaths.includes(source), false);
    assert.equal(actualSitemapPaths.includes(destination), true);
  }

  const releasedAldar = CURRENT_RELEASE_NEWSROOM_REDIRECTS.find(
    ({ source }) => source === CURRENT_RELEASE_ALDAR_REDIRECT_SOURCE,
  );
  assert.equal(
    releasedAldar?.destination,
    CURRENT_RELEASE_ALDAR_REDIRECT_DESTINATION,
  );
  assert.equal(releasedAldar?.statusCode, 301);
  assert.equal(
    actualSitemapPaths.includes(CURRENT_RELEASE_ALDAR_REDIRECT_SOURCE),
    false,
  );
  assert.equal(
    actualSitemapPaths.includes(CURRENT_RELEASE_ALDAR_REDIRECT_DESTINATION),
    true,
  );
}

function assertHeldRoutes() {
  const researchSlugs = NEWS_ARTICLES.filter(
    (article) => article.status === "research",
  ).map((article) => article.slug);
  const marsaResearch =
    "2026-07-24-aldar-unveils-aed-100bn-marsa-al-saadiyat-abu-dhabi-s-final-";

  assert.ok(researchSlugs.includes(marsaResearch));
  assert.equal(
    getNewsArticleLifecycle(marsaResearch)?.disposition,
    "REDIRECT",
  );
  for (const slug of researchSlugs.filter((slug) => slug !== marsaResearch)) {
    assert.equal(getNewsArticleLifecycle(slug)?.disposition, "PRIVATE");
    assert.equal(isRenderableArticleSlug(slug), false);
    assert.equal(
      NEWSROOM_EXACT_REDIRECTS.some(
        (redirect) => redirect.source === `/news/${slug}`,
      ),
      false,
    );
  }

  assert.equal(
    Object.values(AUXILIARY_NEWSROOM_LIFECYCLE).filter(
      (entry) => entry.disposition === "PRIVATE",
    ).length,
    7,
  );

  const contentGaps = [
    {
      source:
        "2026-06-12-dubai-luxury-off-plan-sales-hit-aed4-96bn-in-may",
      destination:
        "2026-08-13-dubai-luxury-segment-posts-aed-87-71bn-as-conviction",
      sourceFact: /AED\s?4\.96\s?(?:billion|bn)/i,
      targetFact: /AED\s?4\.96\s?(?:billion|bn)/i,
      reasonFact: /May AED 4\.96bn.*391 transactions.*asset-class split/i,
    },
    {
      source:
        "2026-06-06-dubai-s-off-plan-dominance-66-900-sales-in-five-months-as-ma",
      destination:
        "2026-07-26-off-plan-sales-capture-71-of-dubai-transactions-as-h1-2026-h",
      sourceFact: /66,900 residential sales/i,
      targetFact: /66,900 residential sales/i,
      reasonFact: /Jan-May 66,900-sales.*AED 196\.2bn.*five-month methodology/i,
    },
  ] as const;

  for (const gap of contentGaps) {
    const sourcePath = `/news/${gap.source}`;
    const held = NEWSROOM_HELD_REDIRECTS[
      sourcePath as keyof typeof NEWSROOM_HELD_REDIRECTS
    ];
    const sourceArticle = NEWS_ARTICLES.find(
      (article) => article.slug === gap.source,
    );
    const targetArticle = NEWS_ARTICLES.find(
      (article) => article.slug === gap.destination,
    );
    assert.ok(held, `${sourcePath} must be held until its facts are merged.`);
    assert.equal(held.destination, `/news/${gap.destination}`);
    assert.match(held.reason, gap.reasonFact);
    assert.ok(sourceArticle);
    assert.ok(targetArticle);
    assert.match(
      [sourceArticle.title, ...sourceArticle.tldr, sourceArticle.body].join(" "),
      gap.sourceFact,
    );
    assert.doesNotMatch(
      [targetArticle.title, ...targetArticle.tldr, targetArticle.body].join(" "),
      gap.targetFact,
      `${held.destination} unexpectedly changed; reassess whether the hold can be released.`,
    );
    assert.equal(isPublicNoindexPath(sourcePath), true);
    assert.equal(isRenderableArticleSlug(gap.source), true);
  }
}

function isHeldRedirect(pathname: string): boolean {
  return Object.hasOwn(NEWSROOM_HELD_REDIRECTS, pathname);
}

function assertNoRetiredPublicHrefs() {
  const effectivePageFiles = [
    "app/page.tsx",
    "app/news/page.tsx",
    "app/news/[slug]/page.tsx",
    "app/areas/[slug]/page.tsx",
    "app/developer/[slug]/page.tsx",
    "app/terminal/page.tsx",
    "app/spatial/page.tsx",
  ];
  const sourceFiles = [
    ...listTsxFiles("components/redesign"),
    ...listTsxFiles("components/terminal"),
    "components/homepage/AuthorBrand.tsx",
    "components/homepage/VerticalsBento.tsx",
    ...effectivePageFiles,
  ];
  const retiredRoots = [
    "/pulse",
    "/areas",
    "/developers",
    "/map",
    "/spatial",
    "/v",
  ];

  for (const relativePath of sourceFiles) {
    const source = read(relativePath);
    for (const href of retiredRoots) {
      const escapedHref = href.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      assert.doesNotMatch(
        source,
        new RegExp(
          "href\\s*(?:=|:)\\s*(?:\\{\\s*)?[\"'`]" +
            escapedHref +
            "(?:[\"'`/?#]|\\$\\{)",
        ),
        `${relativePath} still links to retired newsroom source ${href}.`,
      );
    }
  }

  const navigationSource = [
    read("components/redesign/NewsChrome.tsx"),
    read("components/redesign/NewsFooter.tsx"),
    read("components/redesign/NewsHome.tsx"),
  ].join("\n");
  assert.match(navigationSource, /\/news\?desk=dld-pulse/);
  assert.match(navigationSource, /https:\/\/investwithraj\.com\/developers/);
}

function listTsxFiles(relativeDirectory: string): string[] {
  return readdirSync(resolve(root, relativeDirectory), {
    withFileTypes: true,
  }).flatMap((entry) => {
    const relativePath = `${relativeDirectory}/${entry.name}`;
    if (entry.isDirectory()) return listTsxFiles(relativePath);
    return entry.isFile() && entry.name.endsWith(".tsx") ? [relativePath] : [];
  });
}

function assertApprovedCoverPreserved() {
  const marsaSlug =
    "2026-07-23-aldar-activates-aed-100-bn-marsa-al-saadiyat-saadiyat-island";
  const article = NEWS_ARTICLES.find((candidate) => candidate.slug === marsaSlug);
  assert.ok(article);
  assert.equal(getNewsArticleLifecycle(marsaSlug)?.disposition, "KEEP");
  assert.equal(
    article.heroImage.src,
    `/news/${marsaSlug}/cover.jpg`,
  );
  assert.equal(
    article.heroImage.alt,
    "Official Aldar press image for the Marsa Al Saadiyat masterplan announcement",
  );
  assert.equal(article.heroImage.credit, "Aldar official Marsa Al Saadiyat press media");
  assert.equal(hasVerifiedEditorialImage(article), true);
}
