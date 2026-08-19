import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";

import evidenceRemediation from "../docs/migration/newsroom-legacy-evidence-remediation.json";
import { getNewsForGoogleNewsSitemap } from "../content/news";
import {
  NEWSROOM_EXACT_REDIRECTS,
  NEWSROOM_HELD_REDIRECTS,
  NEWSROOM_RELEASE_REMOVAL_CANDIDATES,
  canonicalNewsroomRedirectDestination,
} from "../lib/news-lifecycle";
import { selectDistinctArticles } from "../lib/news-editorial";
import {
  EVIDENCE_CERTIFIED_INDEXABLE_NEWS_ARTICLES,
  PUBLISHED_NEWS_ARTICLES,
} from "../lib/public-content";
import {
  NEWSROOM_PROTECTION_BYPASS_ENV,
  createProtectedPreviewAuth,
} from "./lib/protected-preview-auth.mjs";

const SITE_ORIGIN = "https://news.investwithraj.com";
const LIFECYCLE_AUTHORITY_PATH =
  "docs/migration/news-url-disposition.csv" as const;
const RUNTIME_MODES = [
  "default",
  "evidence-preview",
  "lifecycle-evidence",
  "production",
] as const;
const FORBIDDEN_HELD_SCHEMA_TYPES = [
  "BreadcrumbList",
  "FAQPage",
  "ImageObject",
  "NewsArticle",
] as const;
const DEFAULT_DEVELOPER_DIRECTORY_CANDIDATES = [
  "2026-06-11-emaar-unveils-dh200bn-masterplan-for-150-000-residents-in-du",
  "2026-07-23-aldar-activates-aed-100-bn-marsa-al-saadiyat-saadiyat-island",
  "2026-07-10-aldar-unveils-dh6bn-yas-point-1-600-residences-anchor-northe",
  "2026-06-10-cbd-and-dubai-holding-real-estate-launch-aed-157-9bn-backed-",
  "2026-07-09-modon-and-adib-launch-75-off-plan-financing-for-abu-dhabi-co",
  "2026-06-10-shangri-la-dubai-sells-for-dh1-1bn-as-sheikh-zayed-road-valu",
] as const;
const HELD_PILOT =
  "2026-07-23-aldar-activates-aed-100-bn-marsa-al-saadiyat-saadiyat-island";

type RuntimeMode = (typeof RUNTIME_MODES)[number];
type RuntimeExpectation = Readonly<{
  discoveryArticleCount: number;
  developerReportCount: number;
  evidenceHoldEnabled: boolean;
  frontItemCount: number;
  lifecycleRedirectCount: number;
  removalGoneCount: number;
  rssItemCount: number;
  sitemapCount: number;
}>;

const MODE_EXPECTATIONS: Readonly<Record<RuntimeMode, RuntimeExpectation>> = {
  default: {
    discoveryArticleCount: 41,
    developerReportCount: 6,
    evidenceHoldEnabled: false,
    frontItemCount: 6,
    lifecycleRedirectCount: 0,
    removalGoneCount: 0,
    rssItemCount: 30,
    sitemapCount: 79,
  },
  "evidence-preview": {
    discoveryArticleCount: 17,
    developerReportCount: 0,
    evidenceHoldEnabled: true,
    frontItemCount: 6,
    lifecycleRedirectCount: 0,
    removalGoneCount: 0,
    rssItemCount: 17,
    sitemapCount: 55,
  },
  "lifecycle-evidence": {
    discoveryArticleCount: 2,
    developerReportCount: 0,
    evidenceHoldEnabled: true,
    frontItemCount: 2,
    lifecycleRedirectCount: 31,
    removalGoneCount: 6,
    rssItemCount: 2,
    sitemapCount: 7,
  },
  production: {
    discoveryArticleCount: 41,
    developerReportCount: 6,
    evidenceHoldEnabled: false,
    frontItemCount: 6,
    lifecycleRedirectCount: 0,
    removalGoneCount: 0,
    rssItemCount: 30,
    sitemapCount: 79,
  },
};

type JsonRecord = Readonly<Record<string, unknown>>;
type CsvRow = Readonly<Record<string, string>>;

type ArticleRuntimeResult = Readonly<{
  canonical: string;
  pathname: string;
  robots: string;
  schemaTypes: readonly string[];
  status: number;
}>;

function parseCsv(input: string): CsvRow[] {
  const records: string[][] = [];
  let record: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (quoted) {
      if (character === '"' && input[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
      continue;
    }
    if (character === '"') {
      quoted = true;
    } else if (character === ",") {
      record.push(field);
      field = "";
    } else if (character === "\n") {
      record.push(field.replace(/\r$/u, ""));
      records.push(record);
      record = [];
      field = "";
    } else {
      field += character;
    }
  }
  assert.equal(quoted, false, "Lifecycle authority contains an open CSV quote.");
  if (field || record.length > 0) {
    record.push(field.replace(/\r$/u, ""));
    records.push(record);
  }

  const [headers, ...rows] = records.filter((row) => row.some(Boolean));
  assert.ok(headers, "Lifecycle authority needs a CSV header.");
  return rows.map((row) =>
    Object.fromEntries(
      headers.map((header, index) => [header, row[index] ?? ""]),
    ),
  );
}

function currentAuthorityStatus(
  currentState: string,
  source: string,
): 200 | 404 {
  if (/^200(?:[,;]|$)/u.test(currentState)) return 200;
  if (/^404(?:[,;]|$)/u.test(currentState)) return 404;
  assert.fail(
    `${source} has unsupported lifecycle-authority current_state: ${currentState}`,
  );
}

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  assert.ok(value, `Set ${name}.`);
  assert.equal(value, value.trim(), `${name} must not contain outer whitespace.`);
  return value;
}

function runtimeMode(value: string): RuntimeMode {
  assert.ok(
    (RUNTIME_MODES as readonly string[]).includes(value),
    `NEWSROOM_RUNTIME_MODE must be one of ${RUNTIME_MODES.join(", ")}.`,
  );
  return value as RuntimeMode;
}

function normalisedAuditUrl(value: string): URL {
  const url = new URL(value);
  assert.ok(url.protocol === "http:" || url.protocol === "https:");
  assert.equal(url.username, "", "NEWSROOM_AUDIT_URL must not contain credentials.");
  assert.equal(url.password, "", "NEWSROOM_AUDIT_URL must not contain credentials.");
  url.pathname = url.pathname.replace(/\/+$/u, "") || "/";
  url.search = "";
  url.hash = "";
  return url;
}

function resolveOutputPath(value: string | undefined): string | null {
  if (value === undefined || value.trim() === "") return null;
  assert.equal(value, value.trim(), "NEWSROOM_AUDIT_OUTPUT has outer whitespace.");
  const root = resolve(process.cwd());
  const output = resolve(root, value);
  const relation = relative(root, output);
  assert.ok(
    relation !== "" && !relation.startsWith("..") && !isAbsolute(relation),
    "NEWSROOM_AUDIT_OUTPUT must resolve inside the newsroom worktree.",
  );
  return output;
}

function tagAttribute(tag: string, name: string): string | null {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const match = tag.match(
    new RegExp(`(?:^|\\s)${escapedName}=["']([^"']*)["']`, "iu"),
  );
  return match?.[1] ?? null;
}

function metadataContent(html: string, name: string): string | null {
  for (const match of html.matchAll(/<meta\b[^>]*>/giu)) {
    const tag = match[0];
    if (tagAttribute(tag, "name")?.toLowerCase() === name.toLowerCase()) {
      return tagAttribute(tag, "content");
    }
  }
  return null;
}

function robotsTokens(value: string | null, context: string): Set<string> {
  assert.ok(value, `${context} has no robots metadata.`);
  const tokens = new Set(
    value
      .split(",")
      .map((token) => token.trim().toLowerCase())
      .filter(Boolean),
  );
  assert.ok(tokens.size > 0, `${context} has empty robots metadata.`);
  return tokens;
}

function assertRobotsDirective(
  value: string | null,
  context: string,
  indexDirective: "index" | "noindex",
): string {
  const tokens = robotsTokens(value, context);
  const rejectedIndexDirective =
    indexDirective === "index" ? "noindex" : "index";
  assert.ok(tokens.has(indexDirective), `${context} lacks ${indexDirective}.`);
  assert.ok(
    !tokens.has(rejectedIndexDirective),
    `${context} also declares ${rejectedIndexDirective}.`,
  );
  assert.ok(tokens.has("follow"), `${context} lacks follow.`);
  assert.ok(!tokens.has("nofollow"), `${context} declares nofollow.`);
  return value ?? "";
}

function canonicalHref(html: string): string | null {
  for (const match of html.matchAll(/<link\b[^>]*>/giu)) {
    const tag = match[0];
    if (tagAttribute(tag, "rel")?.toLowerCase() === "canonical") {
      return tagAttribute(tag, "href");
    }
  }
  return null;
}

function jsonLdDocuments(html: string): unknown[] {
  const documents: unknown[] = [];
  for (const match of html.matchAll(
    /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/giu,
  )) {
    documents.push(JSON.parse(match[1]));
  }
  return documents;
}

function collectSchemaTypes(value: unknown, result = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    for (const item of value) collectSchemaTypes(item, result);
    return result;
  }
  if (value === null || typeof value !== "object") return result;

  const record = value as Record<string, unknown>;
  const type = record["@type"];
  if (typeof type === "string") result.add(type);
  if (Array.isArray(type)) {
    for (const item of type) {
      if (typeof item === "string") result.add(item);
    }
  }
  for (const child of Object.values(record)) collectSchemaTypes(child, result);
  return result;
}

function schemaTypes(html: string): string[] {
  return [...collectSchemaTypes(jsonLdDocuments(html))].sort();
}

function findSchemaObject(value: unknown, type: string): JsonRecord | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findSchemaObject(item, type);
      if (found) return found;
    }
    return null;
  }
  if (value === null || typeof value !== "object") return null;

  const record = value as Record<string, unknown>;
  const schemaType = record["@type"];
  if (
    schemaType === type ||
    (Array.isArray(schemaType) && schemaType.includes(type))
  ) {
    return record;
  }
  for (const child of Object.values(record)) {
    const found = findSchemaObject(child, type);
    if (found) return found;
  }
  return null;
}

function newsArticleSlugOccurrences(value: string): string[] {
  return [
    ...value.matchAll(
      /(?:href=["']|<loc>|<guid[^>]*>)[^<"']*\/news\/([^<"'?#]+)/giu,
    ),
  ].map((match) => match[1]);
}

function newsArticleSlugs(value: string): string[] {
  return newsArticleSlugOccurrences(value)
    .filter((slug, index, all) => all.indexOf(slug) === index);
}

function assertNoHeldReferences(
  surface: string,
  body: string,
  heldSlugs: readonly string[],
): void {
  for (const slug of heldSlugs) {
    assert.ok(!body.includes(slug), `${surface} leaked held slug ${slug}.`);
  }
}

function headerSnapshot(headers: Headers): Readonly<Record<string, string | null>> {
  return {
    cacheControl: headers.get("cache-control"),
    contentSecurityPolicy: headers.get("content-security-policy"),
    contentSecurityPolicyReportOnly: headers.get(
      "content-security-policy-report-only",
    ),
    contentType: headers.get("content-type"),
    location: headers.get("location"),
    referrerPolicy: headers.get("referrer-policy"),
    xContentTypeOptions: headers.get("x-content-type-options"),
    xRobotsTag: headers.get("x-robots-tag"),
  };
}

async function main(): Promise<void> {
  const baseUrl = normalisedAuditUrl(requiredEnvironment("NEWSROOM_AUDIT_URL"));
  const mode = runtimeMode(requiredEnvironment("NEWSROOM_RUNTIME_MODE"));
  const candidateSha = requiredEnvironment("NEWSROOM_CANDIDATE_SHA");
  const buildId = requiredEnvironment("NEWSROOM_BUILD_ID");
  const outputPath = resolveOutputPath(process.env.NEWSROOM_AUDIT_OUTPUT);
  assert.match(candidateSha, /^[0-9a-f]{40}$/u, "Invalid NEWSROOM_CANDIDATE_SHA.");
  assert.match(buildId, /^[A-Za-z0-9_-]+$/u, "Invalid NEWSROOM_BUILD_ID.");

  const expectation = MODE_EXPECTATIONS[mode];
  const newsroomAuth = createProtectedPreviewAuth(
    NEWSROOM_PROTECTION_BYPASS_ENV,
  );
  const lifecycleAuthority = parseCsv(
    readFileSync(resolve(process.cwd(), LIFECYCLE_AUTHORITY_PATH), "utf8"),
  );
  const redirectSourceAuthority = new Map(
    NEWSROOM_EXACT_REDIRECTS.map((redirect) => {
      const authorityRows = lifecycleAuthority.filter(
        (row) => row.current_url === redirect.source,
      );
      assert.equal(
        authorityRows.length,
        1,
        `${redirect.source} must exist exactly once in ${LIFECYCLE_AUTHORITY_PATH}.`,
      );
      const authority = authorityRows[0];
      const currentState = authority.current_state;
      assert.ok(currentState, `${redirect.source} has no current_state.`);
      return [
        redirect.source,
        {
          currentState,
          expectedStatus: currentAuthorityStatus(currentState, redirect.source),
        },
      ] as const;
    }),
  );
  const heldRedirectAuthority = new Map(
    Object.keys(NEWSROOM_HELD_REDIRECTS).map((source) => {
      const authorityRows = lifecycleAuthority.filter(
        (row) => row.current_url === source,
      );
      assert.equal(
        authorityRows.length,
        1,
        `${source} must exist exactly once in ${LIFECYCLE_AUTHORITY_PATH}.`,
      );
      const authority = authorityRows[0];
      assert.equal(
        authority.current_state,
        "200,indexable",
        `${source} must remain current and indexable while lifecycle is OFF.`,
      );
      return [source, authority.current_state] as const;
    }),
  );
  const heldSlugs = evidenceRemediation.records.map((record) => record.slug);
  const certifiedSlugs = EVIDENCE_CERTIFIED_INDEXABLE_NEWS_ARTICLES.map(
    (article) => article.slug,
  ).sort();
  const expectedDiscoveryArticles =
    mode === "default" || mode === "production"
      ? PUBLISHED_NEWS_ARTICLES
      : mode === "evidence-preview"
        ? PUBLISHED_NEWS_ARTICLES.filter(
            (article) => !heldSlugs.includes(article.slug),
          )
        : EVIDENCE_CERTIFIED_INDEXABLE_NEWS_ARTICLES;
  const expectedDiscoverySlugs = expectedDiscoveryArticles
    .map((article) => article.slug)
    .sort();
  const expectedFrontSlugs = selectDistinctArticles(
    expectedDiscoveryArticles,
    6,
  ).map((article) => article.slug);
  const expectedRssSlugs = [...expectedDiscoveryArticles]
    .slice(0, 30)
    .sort((left, right) => right.publishedAt.localeCompare(left.publishedAt))
    .map((article) => article.slug);
  const expectedDiscoverySlugSet = new Set(expectedDiscoverySlugs);
  const auditNow = Date.now();
  const expectedNewsSitemapSlugs = getNewsForGoogleNewsSitemap()
    .filter((article) => expectedDiscoverySlugSet.has(article.slug))
    .filter((article) => {
      const published = new Date(article.publishedAt).getTime();
      return Number.isFinite(published) && published <= auditNow;
    })
    .filter(
      (article, index, all) =>
        all.findIndex((candidate) => candidate.slug === article.slug) === index,
    )
    .slice(0, 1_000)
    .map((article) => article.slug);

  assert.equal(heldSlugs.length, 24);
  assert.equal(new Set(heldSlugs).size, 24);
  assert.equal(certifiedSlugs.length, 2);
  assert.equal(expectedDiscoverySlugs.length, expectation.discoveryArticleCount);
  assert.equal(NEWSROOM_EXACT_REDIRECTS.length, 31);
  assert.equal(redirectSourceAuthority.size, NEWSROOM_EXACT_REDIRECTS.length);
  assert.equal(Object.keys(NEWSROOM_HELD_REDIRECTS).length, 3);
  assert.equal(heldRedirectAuthority.size, 3);
  assert.equal(NEWSROOM_RELEASE_REMOVAL_CANDIDATES.length, 6);

  async function auditedFetch(
    pathname: string,
    options: RequestInit = {},
  ): Promise<Response> {
    const url = new URL(pathname, baseUrl);
    return fetch(
      url,
      newsroomAuth.fetchOptions({
        cache: "no-store",
        redirect: "manual",
        ...options,
      }),
    );
  }

  async function htmlResponse(pathname: string): Promise<{
    body: string;
    headers: Readonly<Record<string, string | null>>;
    status: number;
  }> {
    const response = await auditedFetch(pathname);
    return {
      body: await response.text(),
      headers: headerSnapshot(response.headers),
      status: response.status,
    };
  }

  const buildProbe = await auditedFetch(
    `/_next/static/${encodeURIComponent(buildId)}/_buildManifest.js`,
  );
  assert.equal(buildProbe.status, 200, "The declared build ID is not served.");

  const sitemapResponse = await auditedFetch("/sitemap.xml");
  assert.equal(sitemapResponse.status, 200);
  const sitemapBody = await sitemapResponse.text();
  const sitemapPaths = [...sitemapBody.matchAll(/<loc>([^<]+)<\/loc>/gu)]
    .map((match) => new URL(match[1]).pathname)
    .sort();
  assert.equal(sitemapPaths.length, expectation.sitemapCount);
  if (expectation.evidenceHoldEnabled) {
    assertNoHeldReferences("sitemap", sitemapBody, heldSlugs);
  }
  if (mode === "lifecycle-evidence") {
    assert.deepEqual(sitemapPaths, [
      "/",
      "/about",
      "/about/editorial-standards",
      "/legal/privacy",
      "/news",
      ...certifiedSlugs.map((slug) => `/news/${slug}`),
    ].sort());
  }

  const newsArchive = await htmlResponse("/news");
  assert.equal(newsArchive.status, 200);
  const itemList = jsonLdDocuments(newsArchive.body)
    .map((document) => findSchemaObject(document, "ItemList"))
    .find(Boolean);
  assert.ok(itemList, "The news archive did not emit ItemList schema.");
  const itemListElements = itemList.itemListElement;
  assert.ok(Array.isArray(itemListElements));
  assert.equal(itemListElements.length, expectation.discoveryArticleCount);
  const archiveSlugs = itemListElements
    .map((item) => {
      assert.ok(item && typeof item === "object");
      const url = (item as Record<string, unknown>).url;
      assert.equal(typeof url, "string");
      return new URL(url as string).pathname.replace(/^\/news\//u, "");
    })
    .sort();
  assert.deepEqual(archiveSlugs, expectedDiscoverySlugs);

  const home = await htmlResponse("/");
  assert.equal(home.status, 200);
  const frontResponse = await auditedFetch("/api/front");
  assert.equal(frontResponse.status, 200);
  const frontPayload = (await frontResponse.json()) as {
    items?: Array<{ slug?: unknown }>;
  };
  assert.ok(Array.isArray(frontPayload.items));
  const frontSlugs = frontPayload.items.map((item) => {
    assert.equal(typeof item.slug, "string");
    return item.slug as string;
  });
  assert.equal(frontSlugs.length, expectation.frontItemCount);
  assert.deepEqual(frontSlugs, expectedFrontSlugs);

  const rssResponse = await auditedFetch("/rss.xml");
  assert.equal(rssResponse.status, 200);
  const rssBody = await rssResponse.text();
  const rssSlugs = [
    ...rssBody.matchAll(
      /<guid isPermaLink=["']true["']>[^<]*\/news\/([^<]+)<\/guid>/gu,
    ),
  ].map((match) => match[1]);
  assert.equal(rssSlugs.length, expectation.rssItemCount);
  assert.deepEqual(rssSlugs, expectedRssSlugs);

  const newsSitemapResponse = await auditedFetch("/news-sitemap.xml");
  assert.equal(newsSitemapResponse.status, 200);
  const newsSitemapBody = await newsSitemapResponse.text();
  assert.match(newsSitemapBody, /<urlset\b[\s\S]*<\/urlset>/u);
  const newsSitemapSlugs = newsArticleSlugOccurrences(newsSitemapBody);
  assert.deepEqual(newsSitemapSlugs, expectedNewsSitemapSlugs);
  if (expectedNewsSitemapSlugs.length === 0) {
    assert.match(newsSitemapBody, /No articles published in the last 48 hours/u);
  }

  const developers = await htmlResponse("/developers");
  const expectedDeveloperStatus = mode === "lifecycle-evidence" ? 301 : 200;
  assert.equal(developers.status, expectedDeveloperStatus);
  const developerReportSlugs = newsArticleSlugs(developers.body);
  assert.equal(developerReportSlugs.length, expectation.developerReportCount);
  if (expectation.developerReportCount === 6) {
    assert.deepEqual(
      developerReportSlugs,
      [...DEFAULT_DEVELOPER_DIRECTORY_CANDIDATES],
    );
  } else {
    assert.deepEqual(developerReportSlugs, []);
  }

  if (expectation.evidenceHoldEnabled) {
    for (const [surface, body] of [
      ["front page", home.body],
      ["news archive", newsArchive.body],
      ["front API", JSON.stringify(frontPayload)],
      ["RSS", rssBody],
      ["news sitemap", newsSitemapBody],
      ["developer directory", developers.body],
    ] as const) {
      assertNoHeldReferences(surface, body, heldSlugs);
    }
  }

  const heldArticles: ArticleRuntimeResult[] = [];
  for (const slug of heldSlugs) {
    const pathname = `/news/${slug}`;
    const page = await htmlResponse(pathname);
    assert.equal(page.status, 200, pathname);
    const canonical = canonicalHref(page.body);
    const robotsMetadata = metadataContent(page.body, "robots");
    const types = schemaTypes(page.body);
    assert.equal(canonical, `${SITE_ORIGIN}${pathname}`, `${pathname} canonical`);

    if (expectation.evidenceHoldEnabled) {
      assertRobotsDirective(robotsMetadata, pathname, "noindex");
      for (const type of FORBIDDEN_HELD_SCHEMA_TYPES) {
        assert.ok(!types.includes(type), `${pathname} leaked ${type} schema.`);
      }
    } else {
      assertRobotsDirective(robotsMetadata, pathname, "index");
      assert.ok(types.includes("NewsArticle"), `${pathname} lacks NewsArticle schema.`);
      assert.ok(types.includes("BreadcrumbList"), `${pathname} lacks breadcrumb schema.`);
    }

    if (slug === HELD_PILOT && !expectation.evidenceHoldEnabled) {
      assert.ok(types.includes("FAQPage"), "The held pilot lacks FAQ schema.");
      assert.ok(types.includes("ImageObject"), "The held pilot lacks image schema.");
    }

    heldArticles.push({
      canonical: canonical ?? "",
      pathname,
      robots: robotsMetadata ?? "",
      schemaTypes: types,
      status: page.status,
    });
  }

  const certifiedArticles: ArticleRuntimeResult[] = [];
  for (const slug of certifiedSlugs) {
    const pathname = `/news/${slug}`;
    const page = await htmlResponse(pathname);
    assert.equal(page.status, 200, pathname);
    const canonical = canonicalHref(page.body);
    const robotsMetadata = metadataContent(page.body, "robots");
    const types = schemaTypes(page.body);
    assert.equal(canonical, `${SITE_ORIGIN}${pathname}`);
    assertRobotsDirective(robotsMetadata, pathname, "index");
    assert.ok(types.includes("NewsArticle"));
    assert.ok(types.includes("BreadcrumbList"));
    certifiedArticles.push({
      canonical: canonical ?? "",
      pathname,
      robots: robotsMetadata ?? "",
      schemaTypes: types,
      status: page.status,
    });
  }

  const redirectResults: Array<Readonly<Record<string, unknown>>> = [];
  for (const redirect of [...NEWSROOM_EXACT_REDIRECTS].sort((left, right) =>
    left.source.localeCompare(right.source),
  )) {
    const response = await auditedFetch(redirect.source);
    const location = response.headers.get("location");
    const authority = redirectSourceAuthority.get(redirect.source);
    assert.ok(authority, `${redirect.source} lacks lifecycle authority.`);
    if (mode === "lifecycle-evidence") {
      assert.equal(response.status, 301, redirect.source);
      assert.equal(
        location,
        canonicalNewsroomRedirectDestination(redirect.destination),
        redirect.source,
      );
    } else {
      assert.equal(response.status, authority.expectedStatus, redirect.source);
      assert.equal(location, null, redirect.source);
    }
    redirectResults.push({
      authorityCurrentState: authority.currentState,
      authorityExpectedStatus: authority.expectedStatus,
      actualStatus: response.status,
      destination: redirect.destination,
      location,
      runtimeExpectedStatus:
        mode === "lifecycle-evidence" ? 301 : authority.expectedStatus,
      source: redirect.source,
    });
  }

  const heldRedirectResults: Array<Readonly<Record<string, unknown>>> = [];
  for (const [pathname, hold] of Object.entries(NEWSROOM_HELD_REDIRECTS).sort(
    ([left], [right]) => left.localeCompare(right),
  )) {
    const page = await htmlResponse(pathname);
    assert.equal(page.status, 200, pathname);
    assert.equal(page.headers.location, null, pathname);
    const authorityCurrentState = heldRedirectAuthority.get(pathname);
    assert.equal(authorityCurrentState, "200,indexable", pathname);
    const expectedRobots =
      mode === "lifecycle-evidence" ? "noindex, follow" : "index, follow";
    const robots = assertRobotsDirective(
      metadataContent(page.body, "robots"),
      pathname,
      mode === "lifecycle-evidence" ? "noindex" : "index",
    );
    assert.deepEqual(
      [...robotsTokens(robots, pathname)].sort(),
      expectedRobots.split(", ").sort(),
      `${pathname} robots directives changed.`,
    );
    heldRedirectResults.push({
      actualRobots: robots,
      authorityCurrentState,
      destination: hold.destination,
      expectedRobots,
      pathname,
      status: page.status,
    });
  }

  const removalResults: Array<Readonly<Record<string, unknown>>> = [];
  for (const pathname of [...NEWSROOM_RELEASE_REMOVAL_CANDIDATES].sort()) {
    const methods: Record<string, unknown> = {};
    for (const method of ["GET", "HEAD"] as const) {
      const response = await auditedFetch(`${pathname}?audit=evidence-runtime`, {
        method,
      });
      const body = await response.text();
      const headers = headerSnapshot(response.headers);
      const expectedStatus = mode === "lifecycle-evidence" ? 410 : 200;
      assert.equal(response.status, expectedStatus, `${method} ${pathname}`);
      assert.equal(headers.location, null, `${method} ${pathname}`);
      if (mode === "lifecycle-evidence") {
        assert.equal(headers.cacheControl, "private, no-store, max-age=0");
        assert.equal(headers.xRobotsTag, "noindex, nofollow, noarchive");
        assert.equal(headers.xContentTypeOptions, "nosniff");
        assert.equal(headers.referrerPolicy, "no-referrer");
        assert.match(headers.contentType ?? "", /^text\/plain;\s*charset=utf-8$/iu);
        assert.equal(body, method === "HEAD" ? "" : "Gone\n");
      }
      methods[method.toLowerCase()] = {
        bodyClass:
          body === "Gone\n" ? "Gone\\n" : body === "" ? "empty" : "non-empty",
        headers,
        status: response.status,
      };
    }
    removalResults.push({ methods, pathname });
  }

  const controls: Array<Readonly<Record<string, unknown>>> = [];
  for (const pathname of [
    "/wallet",
    "/news/not-a-removal-candidate",
    `${NEWSROOM_RELEASE_REMOVAL_CANDIDATES[0]}/extra`,
  ]) {
    const response = await auditedFetch(pathname);
    assert.equal(response.status, 404, pathname);
    controls.push({ pathname, status: response.status });
  }

  // htmlResponse stores a serializable snapshot, so enforce Production CSP
  // against the snapshot rather than retaining a Response or request headers.
  if (mode === "production") {
    assert.ok(home.headers.contentSecurityPolicy, "Production CSP is not enforced.");
    assert.equal(home.headers.contentSecurityPolicyReportOnly, null);
  }

  const receipt = {
    schemaVersion: "newsroom-evidence-hold-served-runtime-v1",
    authConfigured: newsroomAuth.authConfigured,
    buildId,
    candidateSha,
    mode,
    expectation,
    buildProbe: { status: buildProbe.status },
    discovery: {
      developers: {
        reportSlugs: developerReportSlugs,
        status: developers.status,
      },
      front: {
        expectedItemSlugs: expectedFrontSlugs,
        itemSlugs: frontSlugs,
        status: frontResponse.status,
      },
      home: { heldReferenceCount: newsArticleSlugs(home.body).filter((slug) => heldSlugs.includes(slug)).length, status: home.status },
      newsArchive: { articleSlugs: archiveSlugs, status: newsArchive.status },
      newsSitemap: {
        articleSlugs: newsSitemapSlugs,
        expectedArticleSlugs: expectedNewsSitemapSlugs,
        status: newsSitemapResponse.status,
      },
      rss: {
        articleSlugs: rssSlugs,
        expectedArticleSlugs: expectedRssSlugs,
        status: rssResponse.status,
      },
      sitemap: { paths: sitemapPaths, status: sitemapResponse.status },
    },
    heldArticles,
    certifiedArticles,
    lifecycleRedirects: redirectResults,
    heldRedirects: heldRedirectResults,
    removals: removalResults,
    controls,
    productionHeaders: home.headers,
  } as const;
  if (outputPath) {
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
  }

  console.log(
    `Newsroom served-runtime PASS: mode=${mode}; sitemap=${sitemapPaths.length}; discovery=${archiveSlugs.length}; redirects=${expectation.lifecycleRedirectCount}; gone=${expectation.removalGoneCount}; held=${heldArticles.length}; authConfigured=${newsroomAuth.authConfigured}; receipt=${outputPath ? "written" : "not-written"}.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
