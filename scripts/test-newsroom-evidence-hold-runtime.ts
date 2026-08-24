import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

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
const IMMUTABLE_NEWSROOM_HOST =
  /^news-investwithraj-site-[a-z0-9]{8,16}-office-2271s-projects\.vercel\.app$/u;
const LOCAL_AUDIT_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]"]);
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
  developerReportCount: number;
  evidenceHoldEnabled: boolean;
  lifecycleRedirectCount: number;
  removalGoneCount: number;
}>;

const MODE_EXPECTATIONS: Readonly<Record<RuntimeMode, RuntimeExpectation>> = {
  default: {
    developerReportCount: 6,
    evidenceHoldEnabled: false,
    lifecycleRedirectCount: 0,
    removalGoneCount: 0,
  },
  "evidence-preview": {
    developerReportCount: 0,
    evidenceHoldEnabled: true,
    lifecycleRedirectCount: 0,
    removalGoneCount: 0,
  },
  "lifecycle-evidence": {
    developerReportCount: 0,
    evidenceHoldEnabled: true,
    lifecycleRedirectCount: 31,
    removalGoneCount: 6,
  },
  production: {
    developerReportCount: 6,
    evidenceHoldEnabled: false,
    lifecycleRedirectCount: 0,
    removalGoneCount: 0,
  },
};

type JsonRecord = Readonly<Record<string, unknown>>;
type CsvRow = Readonly<Record<string, string>>;

type ArticleRuntimeResult = Readonly<{
  allSchemaTypes: readonly string[];
  canonical: string;
  pathname: string;
  robots: string;
  status: number;
  topLevelGraphTypes: readonly string[];
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

export function normalisedAuditUrl(value: string): URL {
  assert.equal(
    /%[0-9a-f]{2}/iu.test(value),
    false,
    "NEWSROOM_AUDIT_URL must not contain percent-encoded input.",
  );
  const url = new URL(value);
  assert.equal(url.username, "", "NEWSROOM_AUDIT_URL must not contain credentials.");
  assert.equal(url.password, "", "NEWSROOM_AUDIT_URL must not contain credentials.");
  assert.equal(url.pathname, "/", "NEWSROOM_AUDIT_URL must be an origin.");
  assert.equal(url.search, "", "NEWSROOM_AUDIT_URL must not contain a query.");
  assert.equal(url.hash, "", "NEWSROOM_AUDIT_URL must not contain a fragment.");
  const local = LOCAL_AUDIT_HOSTS.has(url.hostname);
  if (local) {
    assert.ok(
      url.protocol === "http:" || url.protocol === "https:",
      "Local newsroom audits must use HTTP or HTTPS.",
    );
  } else {
    assert.equal(url.protocol, "https:", "Hosted newsroom audits must use HTTPS.");
    assert.match(
      url.hostname,
      IMMUTABLE_NEWSROOM_HOST,
      "Hosted newsroom audits require the exact immutable newsroom deployment host.",
    );
  }
  return url;
}

export function createRuntimeAuditTransport(
  auditUrl: string,
  environment: Readonly<Record<string, string | undefined>> = process.env,
  fetchImpl: typeof fetch = globalThis.fetch,
): Readonly<{
  auditUrl: string;
  authConfigured: boolean;
  fetch: (pathname: string, options?: RequestInit) => Promise<Response>;
  hosted: boolean;
}> {
  // Validate the complete destination boundary before the bypass credential is
  // read or captured by the protected-Preview adapter.
  const baseUrl = normalisedAuditUrl(auditUrl);
  const hosted = !LOCAL_AUDIT_HOSTS.has(baseUrl.hostname);
  if (!hosted) {
    assert.equal(
      environment[NEWSROOM_PROTECTION_BYPASS_ENV],
      undefined,
      "Local newsroom audits must not configure the hosted bypass credential.",
    );
  }
  const newsroomAuth = createProtectedPreviewAuth(
    NEWSROOM_PROTECTION_BYPASS_ENV,
    (hosted ? environment : {}) as NodeJS.ProcessEnv,
  );
  assert.equal(
    newsroomAuth.authConfigured,
    hosted,
    hosted
      ? "Hosted newsroom audits require protected-Preview authentication."
      : "Local newsroom audits must not configure the hosted bypass credential.",
  );

  return Object.freeze({
    auditUrl: baseUrl.origin,
    authConfigured: newsroomAuth.authConfigured,
    hosted,
    async fetch(pathname: string, options: RequestInit = {}): Promise<Response> {
      assert.equal(typeof pathname, "string", "Audit pathname must be a string.");
      assert.equal(
        /%[0-9a-f]{2}/iu.test(pathname),
        false,
        "Audit pathname must not contain percent-encoded input.",
      );
      assert.ok(
        pathname.startsWith("/") && !pathname.startsWith("//"),
        "Audit pathname must be single-root relative.",
      );
      assert.equal(
        /\\|[\u0000-\u001f\u007f]/u.test(pathname),
        false,
        "Audit pathname must not contain backslashes or control characters.",
      );
      const rawPathname = pathname.split(/[?#]/u, 1)[0];
      assert.equal(
        rawPathname
          .split("/")
          .some((segment) => segment === "." || segment === ".."),
        false,
        "Audit pathname must not contain dot segments.",
      );
      const url = new URL(pathname, baseUrl);
      assert.equal(
        url.origin,
        baseUrl.origin,
        "Audit request escaped the validated newsroom origin.",
      );

      const response = await fetchImpl(
        url,
        newsroomAuth.fetchOptions({
          cache: "no-store",
          ...options,
          // Never follow a response Location with the protected credential.
          redirect: "manual",
        }),
      );
      if (response.url) {
        const delivered = new URL(response.url);
        assert.equal(
          delivered.origin,
          url.origin,
          "Audit response escaped the validated newsroom origin.",
        );
        assert.equal(
          delivered.pathname,
          url.pathname,
          "Audit response changed the requested newsroom path.",
        );
      }
      return response;
    },
  });
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

function topLevelGraphNodes(value: unknown): JsonRecord[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => topLevelGraphNodes(item));
  }
  if (value === null || typeof value !== "object") return [];

  const record = value as Record<string, unknown>;
  if (Array.isArray(record["@graph"])) {
    return record["@graph"].filter(
      (item): item is JsonRecord => item !== null && typeof item === "object",
    );
  }
  return [record];
}

function directSchemaTypes(node: JsonRecord): string[] {
  const type = node["@type"];
  if (typeof type === "string") return [type];
  if (Array.isArray(type)) {
    return type.filter((item): item is string => typeof item === "string");
  }
  return [];
}

function topLevelGraphTypes(html: string): string[] {
  return [
    ...new Set(
      jsonLdDocuments(html)
        .flatMap((document) => topLevelGraphNodes(document))
        .flatMap((node) => directSchemaTypes(node)),
    ),
  ].sort();
}

function topLevelPrimaryImageNodes(html: string): JsonRecord[] {
  return jsonLdDocuments(html)
    .flatMap((document) => topLevelGraphNodes(document))
    .filter((node) => {
      if (!directSchemaTypes(node).includes("ImageObject")) return false;
      return (
        typeof node.contentUrl === "string" ||
        typeof node.url === "string" ||
        (typeof node["@id"] === "string" &&
          /(?:#|\/)(?:primary-?)?image$/iu.test(node["@id"] as string))
      );
    });
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

function xmlLocUrls(value: string): string[] {
  return [...value.matchAll(/<loc>([^<]+)<\/loc>/giu)].map(
    (match) => match[1],
  );
}

function assertCanonicalUrlList(
  actualUrls: readonly string[],
  expectedUrls: readonly string[],
  context: string,
  options: Readonly<{ ordered?: boolean }> = {},
): void {
  assert.equal(
    new Set(actualUrls).size,
    actualUrls.length,
    `${context} contains duplicate URLs.`,
  );
  for (const rawUrl of actualUrls) {
    const url = new URL(rawUrl);
    assert.equal(url.origin, SITE_ORIGIN, `${context} leaked ${url.origin}.`);
    assert.equal(url.username, "", `${context} URL contains a username.`);
    assert.equal(url.password, "", `${context} URL contains a password.`);
    assert.equal(url.search, "", `${context} URL contains a query string.`);
    assert.equal(url.hash, "", `${context} URL contains a fragment.`);
  }
  assert.deepEqual(
    options.ordered ? actualUrls : [...actualUrls].sort(),
    options.ordered ? expectedUrls : [...expectedUrls].sort(),
    `${context} drifted from its authoritative URL set.`,
  );
}

export function canonicalNewsroomUrl(pathname: string): string {
  assert.match(pathname, /^\/(?:[^?#]*)$/u, "Canonical URL requires a pathname.");
  return pathname === "/" ? SITE_ORIGIN : `${SITE_ORIGIN}${pathname}`;
}

function expectedSitemapUrls(
  mode: RuntimeMode,
  lifecycleAuthority: readonly CsvRow[],
  heldSlugs: readonly string[],
  discoverySlugs: readonly string[],
): string[] {
  const lifecycleEnabled = mode === "lifecycle-evidence";
  const evidenceHoldEnabled =
    mode === "evidence-preview" || mode === "lifecycle-evidence";
  const primaryRows = lifecycleAuthority.filter(
    (row) => row.in_sitemap === "yes",
  );
  const eligibleRows = lifecycleEnabled
    ? primaryRows.filter(
        (row) => row.disposition === "KEEP" || row.disposition === "IMPROVE",
      )
    : primaryRows;
  const urls = eligibleRows
    .filter((row) => {
      if (!evidenceHoldEnabled) return true;
      if (!row.current_url.startsWith("/news/")) return true;
      return !heldSlugs.includes(row.current_url.slice("/news/".length));
    })
    .map((row) => {
      assert.match(
        row.current_url,
        /^\/(?:[^?#]*)$/u,
        "Lifecycle authority sitemap URLs must be canonical paths.",
      );
      return canonicalNewsroomUrl(row.current_url);
    });
  const authorityPaths = new Set(
    lifecycleAuthority.map((row) => row.current_url),
  );
  for (const slug of discoverySlugs) {
    const pathname = `/news/${slug}`;
    if (!authorityPaths.has(pathname)) {
      urls.push(canonicalNewsroomUrl(pathname));
    }
  }
  assert.equal(
    new Set(urls).size,
    urls.length,
    "Lifecycle authority contains duplicate sitemap URLs.",
  );
  return urls.sort();
}

function schemaStringValues(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(schemaStringValues);
  if (value === null || typeof value !== "object") {
    return typeof value === "string" ? [value] : [];
  }
  return Object.values(value as JsonRecord).flatMap(schemaStringValues);
}

function assertArticleSchemaCanonicalOrigin(
  html: string,
  pathname: string,
  expectsArticleSchema: boolean,
  auditOrigin: string,
): void {
  const documents = jsonLdDocuments(html);
  const expectedUrl = `${SITE_ORIGIN}${pathname}`;
  for (const value of schemaStringValues(documents)) {
    if (!/^https?:\/\//u.test(value)) continue;
    const url = new URL(value);
    if (auditOrigin !== SITE_ORIGIN) {
      assert.notEqual(
        url.origin,
        auditOrigin,
        `${pathname} schema leaked the audit origin.`,
      );
    }
  }

  const article = documents
    .map((document) => findSchemaObject(document, "NewsArticle"))
    .find(Boolean);
  if (!expectsArticleSchema) {
    assert.equal(article, undefined, `${pathname} leaked NewsArticle schema.`);
    return;
  }
  assert.ok(article, `${pathname} lacks NewsArticle schema.`);
  assert.equal(article["@id"], `${expectedUrl}#article`);
  assert.ok(
    article.mainEntityOfPage && typeof article.mainEntityOfPage === "object",
    `${pathname} lacks a schema mainEntityOfPage.`,
  );
  assert.equal(
    (article.mainEntityOfPage as JsonRecord)["@id"],
    expectedUrl,
    `${pathname} schema mainEntityOfPage is not canonical.`,
  );
  if (article.image !== undefined) {
    assert.ok(typeof article.image === "object" && article.image !== null);
    assert.equal(
      (article.image as JsonRecord)["@id"],
      `${expectedUrl}#primaryimage`,
      `${pathname} schema image reference is not canonical.`,
    );
  }

  const breadcrumb = documents
    .map((document) => findSchemaObject(document, "BreadcrumbList"))
    .find(Boolean);
  assert.ok(breadcrumb, `${pathname} lacks BreadcrumbList schema.`);
  assert.ok(Array.isArray(breadcrumb.itemListElement));
  const breadcrumbItems = breadcrumb.itemListElement as JsonRecord[];
  assert.ok(breadcrumbItems.length > 0);
  assert.equal(
    breadcrumbItems.at(-1)?.item,
    expectedUrl,
    `${pathname} schema breadcrumb is not self-canonical.`,
  );
  for (const item of breadcrumbItems) {
    assert.equal(
      new URL(String(item.item)).origin,
      SITE_ORIGIN,
      `${pathname} schema breadcrumb leaked a non-canonical origin.`,
    );
  }
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
  const auditUrl = requiredEnvironment("NEWSROOM_AUDIT_URL");
  const mode = runtimeMode(requiredEnvironment("NEWSROOM_RUNTIME_MODE"));
  const candidateSha = requiredEnvironment("NEWSROOM_CANDIDATE_SHA");
  const buildId = requiredEnvironment("NEWSROOM_BUILD_ID");
  const outputPath = resolveOutputPath(process.env.NEWSROOM_AUDIT_OUTPUT);
  assert.match(candidateSha, /^[0-9a-f]{40}$/u, "Invalid NEWSROOM_CANDIDATE_SHA.");
  assert.match(buildId, /^[A-Za-z0-9_-]+$/u, "Invalid NEWSROOM_BUILD_ID.");
  const runtimeTransport = createRuntimeAuditTransport(auditUrl);
  const baseUrl = new URL(runtimeTransport.auditUrl);

  const expectation = MODE_EXPECTATIONS[mode];
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
  const expectedDiscoveryUrls = expectedDiscoverySlugs.map(
    (slug) => `${SITE_ORIGIN}/news/${slug}`,
  );
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
  const expectedNewsSitemapUrls = expectedNewsSitemapSlugs.map(
    (slug) => `${SITE_ORIGIN}/news/${slug}`,
  );
  const expectedRssUrls = expectedRssSlugs.map(
    (slug) => `${SITE_ORIGIN}/news/${slug}`,
  );
  const authoritativeSitemapUrls = expectedSitemapUrls(
    mode,
    lifecycleAuthority,
    heldSlugs,
    expectedDiscoverySlugs,
  );

  assert.equal(heldSlugs.length, 24);
  assert.equal(new Set(heldSlugs).size, 24);
  assert.ok(certifiedSlugs.length >= 2, "The certified evidence baseline regressed.");
  assert.equal(NEWSROOM_EXACT_REDIRECTS.length, 31);
  assert.equal(redirectSourceAuthority.size, NEWSROOM_EXACT_REDIRECTS.length);
  assert.equal(Object.keys(NEWSROOM_HELD_REDIRECTS).length, 3);
  assert.equal(heldRedirectAuthority.size, 3);
  assert.equal(NEWSROOM_RELEASE_REMOVAL_CANDIDATES.length, 6);

  async function auditedFetch(
    pathname: string,
    options: RequestInit = {},
  ): Promise<Response> {
    return runtimeTransport.fetch(pathname, options);
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
  const sitemapUrls = xmlLocUrls(sitemapBody);
  assertCanonicalUrlList(
    sitemapUrls,
    authoritativeSitemapUrls,
    "sitemap.xml",
  );
  const sitemapPaths = sitemapUrls.map((url) => new URL(url).pathname).sort();
  assert.equal(sitemapPaths.length, authoritativeSitemapUrls.length);
  if (expectation.evidenceHoldEnabled) {
    assertNoHeldReferences("sitemap", sitemapBody, heldSlugs);
  }

  const newsArchive = await htmlResponse("/news");
  assert.equal(newsArchive.status, 200);
  const itemList = jsonLdDocuments(newsArchive.body)
    .map((document) => findSchemaObject(document, "ItemList"))
    .find(Boolean);
  assert.ok(itemList, "The news archive did not emit ItemList schema.");
  const itemListElements = itemList.itemListElement;
  assert.ok(Array.isArray(itemListElements));
  assert.equal(itemListElements.length, expectedDiscoverySlugs.length);
  const archiveUrls = itemListElements.map((item) => {
    assert.ok(item && typeof item === "object");
    const url = (item as Record<string, unknown>).url;
    assert.equal(typeof url, "string");
    return url as string;
  });
  assertCanonicalUrlList(
    archiveUrls,
    expectedDiscoveryUrls,
    "news archive ItemList schema",
  );
  const archiveSlugs = archiveUrls
    .map((url) => new URL(url).pathname.replace(/^\/news\//u, ""))
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
  assert.equal(frontSlugs.length, expectedFrontSlugs.length);
  assert.deepEqual(frontSlugs, expectedFrontSlugs);

  const rssResponse = await auditedFetch("/rss.xml");
  assert.equal(rssResponse.status, 200);
  const rssBody = await rssResponse.text();
  const rssGuidUrls = [
    ...rssBody.matchAll(/<guid isPermaLink=["']true["']>([^<]+)<\/guid>/gu),
  ].map((match) => match[1]);
  assertCanonicalUrlList(rssGuidUrls, expectedRssUrls, "RSS GUIDs", {
    ordered: true,
  });
  const rssItemLinkUrls = [
    ...rssBody.matchAll(/<item>[\s\S]*?<link>([^<]+)<\/link>/gu),
  ].map((match) => match[1]);
  assertCanonicalUrlList(rssItemLinkUrls, expectedRssUrls, "RSS item links", {
    ordered: true,
  });
  assert.ok(
    rssBody.includes(`<channel>\n    <title>`) &&
      rssBody.includes(`<link>${SITE_ORIGIN}</link>`) &&
      rssBody.includes(
        `<atom:link href="${SITE_ORIGIN}/rss.xml" rel="self" type="application/rss+xml" />`,
      ),
    "RSS channel or self URL is not canonical.",
  );
  const rssSlugs = rssGuidUrls.map((url) =>
    new URL(url).pathname.replace(/^\/news\//u, ""),
  );
  assert.equal(rssSlugs.length, expectedRssSlugs.length);
  assert.deepEqual(rssSlugs, expectedRssSlugs);

  const newsSitemapResponse = await auditedFetch("/news-sitemap.xml");
  assert.equal(newsSitemapResponse.status, 200);
  const newsSitemapBody = await newsSitemapResponse.text();
  assert.match(newsSitemapBody, /<urlset\b[\s\S]*<\/urlset>/u);
  const newsSitemapUrls = xmlLocUrls(newsSitemapBody);
  assertCanonicalUrlList(
    newsSitemapUrls,
    expectedNewsSitemapUrls,
    "news-sitemap.xml",
    { ordered: true },
  );
  const newsSitemapSlugs = newsSitemapUrls.map((url) =>
    new URL(url).pathname.replace(/^\/news\//u, ""),
  );
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
    const allTypes = schemaTypes(page.body);
    const topTypes = topLevelGraphTypes(page.body);
    assert.equal(canonical, `${SITE_ORIGIN}${pathname}`, `${pathname} canonical`);
    assertArticleSchemaCanonicalOrigin(
      page.body,
      pathname,
      !expectation.evidenceHoldEnabled,
      baseUrl.origin,
    );

    if (expectation.evidenceHoldEnabled) {
      assertRobotsDirective(robotsMetadata, pathname, "noindex");
      for (const type of FORBIDDEN_HELD_SCHEMA_TYPES) {
        assert.ok(
          !topTypes.includes(type),
          `${pathname} leaked top-level ${type} schema.`,
        );
      }
      assert.deepEqual(
        topLevelPrimaryImageNodes(page.body),
        [],
        `${pathname} leaked a top-level primary-image node.`,
      );
    } else {
      assertRobotsDirective(robotsMetadata, pathname, "index");
      assert.ok(topTypes.includes("NewsArticle"), `${pathname} lacks NewsArticle schema.`);
      assert.ok(topTypes.includes("BreadcrumbList"), `${pathname} lacks breadcrumb schema.`);
    }

    if (slug === HELD_PILOT && !expectation.evidenceHoldEnabled) {
      assert.ok(topTypes.includes("FAQPage"), "The held pilot lacks FAQ schema.");
      assert.ok(topTypes.includes("ImageObject"), "The held pilot lacks image schema.");
    }

    heldArticles.push({
      allSchemaTypes: allTypes,
      canonical: canonical ?? "",
      pathname,
      robots: robotsMetadata ?? "",
      status: page.status,
      topLevelGraphTypes: topTypes,
    });
  }

  const certifiedArticles: ArticleRuntimeResult[] = [];
  for (const slug of certifiedSlugs) {
    const pathname = `/news/${slug}`;
    const page = await htmlResponse(pathname);
    assert.equal(page.status, 200, pathname);
    const canonical = canonicalHref(page.body);
    const robotsMetadata = metadataContent(page.body, "robots");
    const allTypes = schemaTypes(page.body);
    const topTypes = topLevelGraphTypes(page.body);
    assert.equal(canonical, `${SITE_ORIGIN}${pathname}`);
    assertArticleSchemaCanonicalOrigin(
      page.body,
      pathname,
      true,
      baseUrl.origin,
    );
    assertRobotsDirective(robotsMetadata, pathname, "index");
    assert.ok(topTypes.includes("NewsArticle"));
    assert.ok(topTypes.includes("BreadcrumbList"));
    certifiedArticles.push({
      allSchemaTypes: allTypes,
      canonical: canonical ?? "",
      pathname,
      robots: robotsMetadata ?? "",
      status: page.status,
      topLevelGraphTypes: topTypes,
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
    authConfigured: runtimeTransport.authConfigured,
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
    `Newsroom served-runtime PASS: mode=${mode}; sitemap=${sitemapPaths.length}; discovery=${archiveSlugs.length}; redirects=${expectation.lifecycleRedirectCount}; gone=${expectation.removalGoneCount}; held=${heldArticles.length}; authConfigured=${runtimeTransport.authConfigured}; receipt=${outputPath ? "written" : "not-written"}.`,
  );
}

const isMain =
  process.argv[1] !== undefined &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (isMain) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
