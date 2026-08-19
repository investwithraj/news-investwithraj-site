#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  NEWSROOM_PROTECTION_BYPASS_ENV,
  PROTECTION_BYPASS_HEADER,
  createProtectedPreviewAuth,
} from "./lib/protected-preview-auth.mjs";

export const EXPECTED_CANDIDATE_SHA =
  "54c35668f90dcdf696785c6fd5cc6e67a268e866";
export const EXPECTED_GENERATED_PAGES = 98;
export const EXPECTED_SITEMAP_ROUTES = 79;
export const EXPECTED_PUBLIC_ARTICLES = 41;
export const EXPECTED_HTML_AUTHORITY_ROUTES = 85;
export const EXPECTED_VIEWPORT_CASES = 170;
export const EXPECTED_STATIC_ROUTES = 7;
export const EXPECTED_PRIVATE_ROUTES = 2;
export const EXPECTED_NOT_FOUND_ROUTES = 3;
export const NEWSROOM_CANONICAL_ORIGIN = "https://news.investwithraj.com";
export const IMMUTABLE_NEWSROOM_HOST =
  /^news-investwithraj-site-[a-z0-9]{8,16}-office-2271s-projects\.vercel\.app$/u;

const RETAINED_HTML_ROUTES = Object.freeze([
  { path: "/ask", noindex: true },
  { path: "/closing-bell", noindex: true },
  { path: "/power-list/2026", noindex: true },
  { path: "/pulse", noindex: true },
  { path: "/spatial", noindex: true },
]);
const PRIVATE_ROUTES = Object.freeze(["/internal/dashboard", "/internal/review"]);
const STATIC_ROUTES = Object.freeze([
  {
    path: "/0d6e3835646ccbe5dba5ed6ab2646308.txt",
    contentType: /^text\/plain/iu,
  },
  { path: "/icon.svg", contentType: /^image\/svg\+xml/iu },
  { path: "/llms.txt", contentType: /^text\/plain/iu },
  { path: "/news-sitemap.xml", contentType: /^(?:application|text)\/xml/iu },
  { path: "/robots.txt", contentType: /^text\/plain/iu },
  { path: "/rss.xml", contentType: /^(?:application|text)\/(?:rss\+xml|xml)/iu },
  { path: "/sitemap.xml", contentType: /^(?:application|text)\/xml/iu },
]);
const VIEWPORTS = Object.freeze([
  { name: "desktop", width: 1440, height: 1000 },
  { name: "mobile", width: 390, height: 844 },
]);
const REQUEST_TIMEOUT_MS = 45_000;

const remediation = JSON.parse(
  readFileSync(
    new URL("../docs/migration/newsroom-legacy-evidence-remediation.json", import.meta.url),
    "utf8",
  ),
);

function requiredValue(environment, name) {
  const value = environment[name];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TypeError(`${name} must be a non-empty string`);
  }
  if (value !== value.trim() || /[\u0000-\u001f\u007f]/u.test(value)) {
    throw new TypeError(`${name} must not contain surrounding whitespace or control characters`);
  }
  return value;
}

export function parseHostedBrowserConfiguration(environment = process.env) {
  if (environment.IWR_EXPECT_NEWSROOM_PROTECTED_PREVIEW !== "1") {
    throw new TypeError("IWR_EXPECT_NEWSROOM_PROTECTED_PREVIEW must equal 1");
  }
  const suppliedUrl = requiredValue(environment, "IWR_NEWS_AUDIT_URL");
  const candidateSha = requiredValue(environment, "IWR_NEWS_CANDIDATE_SHA");
  const buildId = requiredValue(environment, "IWR_NEWS_BUILD_ID");
  const auditOutput = requiredValue(environment, "IWR_NEWS_AUDIT_OUTPUT");
  assert.equal(
    candidateSha,
    EXPECTED_CANDIDATE_SHA,
    "Hosted browser gate must target the certified newsroom runtime SHA",
  );
  assert.match(
    buildId,
    /^[A-Za-z0-9_-]{8,128}$/u,
    "IWR_NEWS_BUILD_ID must be an exact Next build identifier",
  );
  const auditUrl = new URL(suppliedUrl);
  assert.equal(auditUrl.username, "", "Audit URL must not contain credentials");
  assert.equal(auditUrl.password, "", "Audit URL must not contain credentials");
  assert.equal(auditUrl.pathname, "/", "Audit URL must be an origin URL");
  assert.equal(auditUrl.search, "", "Audit URL must not contain a query");
  assert.equal(auditUrl.hash, "", "Audit URL must not contain a fragment");
  const local = ["127.0.0.1", "localhost", "[::1]"].includes(auditUrl.hostname);
  const hosted = IMMUTABLE_NEWSROOM_HOST.test(auditUrl.hostname);
  assert.ok(
    local || hosted,
    "Audit URL must be localhost or the exact immutable newsroom deployment hostname",
  );
  if (hosted) {
    assert.equal(auditUrl.protocol, "https:", "Hosted Preview must use HTTPS");
  } else {
    assert.ok(
      ["http:", "https:"].includes(auditUrl.protocol),
      "Local audit URL must use HTTP or HTTPS",
    );
  }
  return Object.freeze({
    auditOutput,
    auditUrl: auditUrl.origin,
    buildId,
    candidateSha,
    hosted,
  });
}

function schemaNodes(document) {
  if (Array.isArray(document)) return document.flatMap(schemaNodes);
  if (Array.isArray(document?.["@graph"])) return document["@graph"].flatMap(schemaNodes);
  return document && typeof document === "object" ? [document] : [];
}

function jsonLdDocuments(html) {
  return [
    ...html.matchAll(
      /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/giu,
    ),
  ].map((match) => JSON.parse(match[1]));
}

export function parseSitemapPaths(xml) {
  const paths = [...xml.matchAll(/<loc>([^<]+)<\/loc>/gu)].map((match) => {
    const url = new URL(match[1]);
    assert.equal(url.origin, NEWSROOM_CANONICAL_ORIGIN, "Sitemap URL host drifted");
    assert.equal(url.search, "", "Sitemap URL must not contain a query");
    assert.equal(url.hash, "", "Sitemap URL must not contain a fragment");
    return url.pathname;
  });
  assert.equal(paths.length, EXPECTED_SITEMAP_ROUTES, "Default sitemap route count drifted");
  assert.equal(new Set(paths).size, paths.length, "Default sitemap routes must be unique");
  return paths;
}

export function parseArchiveArticlePaths(html) {
  const itemLists = jsonLdDocuments(html)
    .flatMap(schemaNodes)
    .filter((node) => {
      const type = node?.["@type"];
      return type === "ItemList" || (Array.isArray(type) && type.includes("ItemList"));
    });
  assert.equal(itemLists.length, 1, "News archive must expose one ItemList authority");
  const items = itemLists[0].itemListElement;
  assert.ok(Array.isArray(items), "News archive ItemList is malformed");
  const paths = items.map((item) => {
    const supplied = item?.url ?? item?.item?.url;
    assert.equal(typeof supplied, "string", "News archive ItemList entry lacks a URL");
    const url = new URL(supplied, NEWSROOM_CANONICAL_ORIGIN);
    assert.equal(url.origin, NEWSROOM_CANONICAL_ORIGIN, "Article URL host drifted");
    assert.ok(url.pathname.startsWith("/news/"), "Article URL is outside /news");
    return url.pathname;
  });
  assert.equal(paths.length, EXPECTED_PUBLIC_ARTICLES, "Public article count drifted");
  assert.equal(new Set(paths).size, paths.length, "Public article routes must be unique");
  return paths;
}

export function buildHtmlRouteAuthority(sitemapPaths, articlePaths) {
  const publicPaths = [...new Set([...sitemapPaths, ...articlePaths])];
  assert.equal(publicPaths.length, 80, "Sitemap/archive public-route union drifted");
  assert.equal(
    articlePaths.filter((articlePath) => !sitemapPaths.includes(articlePath)).length,
    1,
    "The retained merged article source topology drifted",
  );
  const routes = [
    ...publicPaths.map((routePath) => ({ path: routePath, noindex: false })),
    ...RETAINED_HTML_ROUTES,
  ];
  assert.equal(routes.length, EXPECTED_HTML_AUTHORITY_ROUTES);
  assert.equal(new Set(routes.map((route) => route.path)).size, routes.length);
  return routes;
}

export function heldArticlePaths() {
  const paths = remediation.records.map((record) => `/news/${record.slug}`);
  assert.equal(paths.length, 24, "Evidence-held article authority drifted");
  assert.equal(new Set(paths).size, paths.length, "Evidence-held routes must be unique");
  return paths;
}

function validateResponseRoute(response, requestUrl, label) {
  assert.equal(response.headers.get("location"), null, `${label} must not redirect`);
  if (response.url) {
    const delivered = new URL(response.url);
    assert.equal(delivered.origin, requestUrl.origin, `${label} left the audited origin`);
    assert.equal(delivered.pathname, requestUrl.pathname, `${label} changed pathname`);
    assert.equal(delivered.search, "", `${label} added a query`);
  }
}

async function auditedFetch(fetchImpl, auth, requestUrl, options = {}) {
  return fetchImpl(
    requestUrl,
    auth.fetchOptions({
      ...options,
      redirect: "manual",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    }),
  );
}

export function isExactAuditOrigin(requestUrl, auditOrigin) {
  return new URL(requestUrl).origin === new URL(auditOrigin).origin;
}

export function originScopedRequestHeaders(auth, requestUrl, auditOrigin, headers = {}) {
  const retainedHeaders = new Headers(headers);
  retainedHeaders.delete(PROTECTION_BYPASS_HEADER);
  if (!isExactAuditOrigin(requestUrl, auditOrigin)) {
    return Object.fromEntries(retainedHeaders.entries());
  }
  const authenticated = auth.fetchOptions({ headers: retainedHeaders }).headers;
  return Object.fromEntries(new Headers(authenticated).entries());
}

export async function installOriginScopedBrowserAuth(context, auth, auditOrigin) {
  await context.route("**/*", async (route) => {
    const request = route.request();
    if (!isExactAuditOrigin(request.url(), auditOrigin)) {
      await route.continue({
        headers: originScopedRequestHeaders(
          auth,
          request.url(),
          auditOrigin,
          request.headers(),
        ),
      });
      return;
    }
    const response = await route.fetch({
      headers: originScopedRequestHeaders(
        auth,
        request.url(),
        auditOrigin,
        request.headers(),
      ),
      maxRedirects: 0,
      timeout: REQUEST_TIMEOUT_MS,
    });
    await route.fulfill({ response });
  });
}

export function createOriginScopedRequestClient(
  auth,
  auditOrigin,
  fetchImpl = globalThis.fetch,
) {
  const origin = new URL(auditOrigin);
  assert.equal(origin.href, `${origin.origin}/`, "Request client requires an origin URL");
  assert.equal(typeof fetchImpl, "function", "Request client requires fetch");
  return Object.freeze({
    async get(input, options = {}) {
      const requestUrl = new URL(input, origin);
      assert.equal(
        requestUrl.origin,
        origin.origin,
        "Request client target escaped the exact audit origin",
      );
      const response = await auditedFetch(fetchImpl, auth, requestUrl, {
        ...options,
        method: "GET",
      });
      validateResponseRoute(response, requestUrl, requestUrl.pathname);
      return Object.freeze({
        headers: () => Object.fromEntries(response.headers.entries()),
        status: () => response.status,
        text: () => response.text(),
      });
    },
  });
}

export function navigationIdentityProblems({
  pageUrl,
  redirected,
  requestedUrl,
  responseUrl,
}) {
  const problems = [];
  if (redirected) problems.push("navigation redirected");
  if (responseUrl !== requestedUrl) problems.push(`response URL ${responseUrl}`);
  if (pageUrl !== requestedUrl) problems.push(`page URL ${pageUrl}`);
  return problems;
}

async function dismissConsent(page) {
  for (const pattern of [/reject optional/i, /essential only/i, /accept all/i]) {
    const button = page.getByRole("button", { name: pattern }).first();
    if (await button.isVisible().catch(() => false)) {
      await button.click();
      return;
    }
  }
}

async function settlePage(page) {
  await page.evaluate(async () => {
    const height = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
    const step = Math.max(320, Math.floor(window.innerHeight * 0.8));
    for (let top = 0; top < height; top += step) {
      window.scrollTo({ top, behavior: "instant" });
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    window.scrollTo({ top: 0, behavior: "instant" });
  });
  await page.waitForTimeout(80);
}

function ignorableConsoleError(message) {
  return /favicon|ERR_ABORTED|message port closed|google-analytics|googletagmanager|facebook|linkedin/iu.test(
    message.text(),
  );
}

async function pageState(page) {
  return page.evaluate(() => {
    const visible = (element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        Number(style.opacity) > 0 &&
        rect.width > 1 &&
        rect.height > 1
      );
    };
    const schemas = [];
    const schemaErrors = [];
    for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
      try {
        schemas.push(JSON.parse(script.textContent || "{}"));
      } catch (error) {
        schemaErrors.push(String(error));
      }
    }
    const schemaTypes = schemas
      .flatMap((document) => {
        if (Array.isArray(document)) return document;
        return Array.isArray(document?.["@graph"]) ? document["@graph"] : [document];
      })
      .flatMap((node) => (Array.isArray(node?.["@type"]) ? node["@type"] : [node?.["@type"]]))
      .filter(Boolean);
    const canonicals = [...document.querySelectorAll('link[rel="canonical"]')].map(
      (link) => link.href,
    );
    const images = [...document.images].map((image) => ({
      altPresent: image.hasAttribute("alt"),
      complete: image.complete,
      height: image.naturalHeight,
      source: image.currentSrc || image.src,
      width: image.naturalWidth,
    }));
    const unnamedControls = [
      ...document.querySelectorAll("a[href],button,input,select,textarea"),
    ]
      .filter(visible)
      .filter((element) => {
        const name =
          element.getAttribute("aria-label") ||
          element.getAttribute("title") ||
          element.textContent ||
          element.getAttribute("value") ||
          "";
        return name.trim().length === 0;
      }).length;
    const ids = [...document.querySelectorAll("[id]")].map((element) => element.id);
    return {
      canonical: canonicals,
      documentLanguage: document.documentElement.lang,
      duplicateIds: ids.length - new Set(ids).size,
      h1Count: document.querySelectorAll("h1").length,
      head: document.head.innerHTML,
      images,
      mainCount: document.querySelectorAll("main").length,
      noindex: /noindex/iu.test(
        document.querySelector('meta[name="robots"]')?.getAttribute("content") || "",
      ),
      overflow: Math.max(0, document.documentElement.scrollWidth - window.innerWidth),
      schemaErrors,
      schemaTypes,
      title: document.title,
      unnamedControls,
    };
  });
}

export function buildHostedBrowserReceipt({
  articlePaths,
  authConfigured,
  buildAssetStatus,
  buildPath,
  config,
  endpointResults,
  findings,
  heldPaths,
  notFoundResults,
  privateResults,
  routeResults,
  routes,
  sitemapPaths,
}) {
  assert.equal(routes.length, EXPECTED_HTML_AUTHORITY_ROUTES);
  assert.equal(routeResults.length, EXPECTED_VIEWPORT_CASES);
  assert.equal(endpointResults.length, EXPECTED_STATIC_ROUTES);
  assert.equal(privateResults.length, EXPECTED_PRIVATE_ROUTES);
  assert.equal(notFoundResults.length, EXPECTED_NOT_FOUND_ROUTES);
  return Object.freeze({
    schemaVersion: 1,
    auditUrl: config.auditUrl,
    authConfigured,
    candidate: {
      buildAssetPath: buildPath,
      buildAssetStatus,
      buildId: config.buildId,
      expectedGeneratedPages: EXPECTED_GENERATED_PAGES,
      sha: config.candidateSha,
    },
    authority: {
      articleRoutes: articlePaths.length,
      heldArticleRoutes: heldPaths.length,
      htmlRoutes: routes.length,
      sitemapRoutes: sitemapPaths.length,
      viewportCases: routeResults.length,
    },
    controls: {
      notFound: notFoundResults,
      private: privateResults,
      static: endpointResults,
    },
    result: findings.length === 0 ? "pass" : "fail",
    findings,
    routes: routeResults,
  });
}

export async function runNewsroomHostedBrowserGate({
  environment = process.env,
  fetchImpl = globalThis.fetch,
  playwright = null,
} = {}) {
  const config = parseHostedBrowserConfiguration(environment);
  const auth = createProtectedPreviewAuth(NEWSROOM_PROTECTION_BYPASS_ENV, environment);
  if (config.hosted) {
    assert.equal(auth.authConfigured, true, "Hosted newsroom Preview requires protection auth");
  }
  assert.equal(typeof fetchImpl, "function", "A fetch implementation is required");

  const buildPath = `/_next/static/${config.buildId}/_buildManifest.js`;
  const buildUrl = new URL(buildPath, config.auditUrl);
  const buildResponse = await auditedFetch(fetchImpl, auth, buildUrl, { method: "HEAD" });
  validateResponseRoute(buildResponse, buildUrl, "build identity");
  assert.equal(buildResponse.status, 200, "Hosted build manifest is unavailable");
  assert.match(
    buildResponse.headers.get("content-type") ?? "",
    /^(?:application|text)\/(?:javascript|x-javascript)/iu,
    "Hosted build manifest must be JavaScript",
  );

  const sitemapUrl = new URL("/sitemap.xml", config.auditUrl);
  const sitemapResponse = await auditedFetch(fetchImpl, auth, sitemapUrl);
  validateResponseRoute(sitemapResponse, sitemapUrl, "sitemap");
  assert.equal(sitemapResponse.status, 200);
  const sitemapPaths = parseSitemapPaths(await sitemapResponse.text());

  const archiveUrl = new URL("/news", config.auditUrl);
  const archiveResponse = await auditedFetch(fetchImpl, auth, archiveUrl);
  validateResponseRoute(archiveResponse, archiveUrl, "news archive authority");
  assert.equal(archiveResponse.status, 200);
  const articlePaths = parseArchiveArticlePaths(await archiveResponse.text());
  const routes = buildHtmlRouteAuthority(sitemapPaths, articlePaths);
  const heldPaths = heldArticlePaths();
  assert.ok(heldPaths.every((heldPath) => articlePaths.includes(heldPath)));

  const chromium = playwright?.chromium ?? (() => {
    const bundledModules =
      environment.CODEX_BUNDLED_NODE_MODULES ??
      "C:\\Users\\RAJTO\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\node\\node_modules";
    const require = createRequire(path.join(bundledModules, "_newsroom-hosted-browser.cjs"));
    return require("playwright").chromium;
  })();
  const executablePath =
    environment.IWR_CHROME_PATH ??
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  const browser = await chromium.launch({
    executablePath,
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-background-networking"],
  });
  const findings = [];
  const routeResults = [];
  try {
    for (const viewport of VIEWPORTS) {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        reducedMotion: viewport.name === "mobile" ? "reduce" : "no-preference",
        serviceWorkers: "block",
      });
      await installOriginScopedBrowserAuth(context, auth, config.auditUrl);
      for (const route of routes) {
        const page = await context.newPage();
        const runtimeErrors = [];
        const failedMedia = [];
        page.on("pageerror", (error) => runtimeErrors.push(`pageerror: ${error.message}`));
        page.on("console", (message) => {
          if (message.type() === "error" && !ignorableConsoleError(message)) {
            runtimeErrors.push(`console: ${message.text()}`);
          }
        });
        page.on("requestfailed", (request) => {
          const requestUrl = new URL(request.url());
          if (
            requestUrl.origin === config.auditUrl &&
            /\.(?:avif|gif|jpe?g|mp4|png|svg|webm|webp)(?:\?|$)/iu.test(requestUrl.pathname)
          ) {
            failedMedia.push(`${requestUrl.pathname}: ${request.failure()?.errorText ?? "failed"}`);
          }
        });
        const requestedUrl = new URL(route.path, config.auditUrl).href;
        const response = await page.goto(requestedUrl, {
          waitUntil: "domcontentloaded",
          timeout: REQUEST_TIMEOUT_MS,
        });
        await dismissConsent(page);
        await settlePage(page);
        const state = await pageState(page);
        const expectedCanonical = new URL(route.path, `${NEWSROOM_CANONICAL_ORIGIN}/`).href;
        const problems = navigationIdentityProblems({
          pageUrl: page.url(),
          redirected: response?.request().redirectedFrom() !== null,
          requestedUrl,
          responseUrl: response?.url() ?? "",
        });
        if (response?.status() !== 200) problems.push(`status ${response?.status()}`);
        if (state.mainCount !== 1) problems.push(`main count ${state.mainCount}`);
        if (state.h1Count !== 1) problems.push(`h1 count ${state.h1Count}`);
        if (state.canonical.length !== 1 || state.canonical[0] !== expectedCanonical) {
          problems.push(`canonical ${state.canonical.join(",")}`);
        }
        if (state.noindex !== route.noindex) problems.push(`noindex ${state.noindex}`);
        if (state.overflow > 1) problems.push(`overflow ${state.overflow}`);
        if (!/^en(?:-|$)/iu.test(state.documentLanguage)) {
          problems.push(`language ${state.documentLanguage}`);
        }
        if (state.title.trim().length < 8) problems.push("missing title");
        if (state.duplicateIds > 0) problems.push(`duplicate IDs ${state.duplicateIds}`);
        if (state.unnamedControls > 0) problems.push(`unnamed controls ${state.unnamedControls}`);
        if (state.schemaErrors.length > 0) problems.push(`schema ${state.schemaErrors.join(",")}`);
        if (
          state.images.some(
            (image) => !image.altPresent || !image.complete || image.width < 1 || image.height < 1,
          )
        ) {
          problems.push("broken or inaccessible image");
        }
        if (failedMedia.length > 0) problems.push(`failed media ${failedMedia.join(",")}`);
        if (runtimeErrors.length > 0) problems.push(`runtime ${runtimeErrors.join(",")}`);
        const auditHostname = new URL(config.auditUrl).hostname.toLowerCase();
        if (
          config.hosted &&
          state.head.toLowerCase().includes(auditHostname)
        ) {
          problems.push("Preview hostname leaked into metadata");
        }
        if (heldPaths.includes(route.path) && !state.schemaTypes.includes("NewsArticle")) {
          problems.push("default held article lost NewsArticle schema");
        }
        routeResults.push({
          path: route.path,
          problems,
          status: response?.status() ?? null,
          viewport: viewport.name,
        });
        if (problems.length > 0) findings.push({ path: route.path, problems, viewport: viewport.name });
        await page.close();
      }
      await context.close();
    }
  } finally {
    await browser.close();
  }

  const endpointResults = [];
  for (const endpoint of STATIC_ROUTES) {
    const requestUrl = new URL(endpoint.path, config.auditUrl);
    const response = await auditedFetch(fetchImpl, auth, requestUrl);
    validateResponseRoute(response, requestUrl, endpoint.path);
    assert.equal(response.status, 200, `${endpoint.path} must return 200`);
    assert.match(
      response.headers.get("content-type") ?? "",
      endpoint.contentType,
      `${endpoint.path} content type drifted`,
    );
    endpointResults.push({ path: endpoint.path, status: response.status });
    if (response.body) await response.body.cancel();
  }

  const privateResults = [];
  for (const privatePath of PRIVATE_ROUTES) {
    const requestUrl = new URL(privatePath, config.auditUrl);
    const response = await auditedFetch(fetchImpl, auth, requestUrl);
    validateResponseRoute(response, requestUrl, privatePath);
    assert.ok([401, 403, 503].includes(response.status), `${privatePath} must fail closed`);
    assert.match(response.headers.get("x-robots-tag") ?? "", /noindex/iu);
    privateResults.push({ path: privatePath, status: response.status });
    if (response.body) await response.body.cancel();
  }

  const notFoundPaths = [
    "/wallet",
    "/news/not-a-hosted-preview-route",
    `${heldPaths[0]}/extra`,
  ];
  const notFoundResults = [];
  for (const notFoundPath of notFoundPaths) {
    const requestUrl = new URL(notFoundPath, config.auditUrl);
    const response = await auditedFetch(fetchImpl, auth, requestUrl);
    validateResponseRoute(response, requestUrl, notFoundPath);
    assert.equal(response.status, 404, `${notFoundPath} must remain 404`);
    notFoundResults.push({ path: notFoundPath, status: response.status });
    if (response.body) await response.body.cancel();
  }

  const receipt = buildHostedBrowserReceipt({
    articlePaths,
    authConfigured: auth.authConfigured,
    buildAssetStatus: buildResponse.status,
    buildPath,
    config,
    endpointResults,
    findings,
    heldPaths,
    notFoundResults,
    privateResults,
    routeResults,
    routes,
    sitemapPaths,
  });
  await mkdir(path.dirname(config.auditOutput), { recursive: true });
  await writeFile(config.auditOutput, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
  assert.deepEqual(findings, [], JSON.stringify(findings, null, 2));
  return receipt;
}

async function main() {
  const receipt = await runNewsroomHostedBrowserGate();
  console.log(
    `Newsroom hosted browser PASS: ${receipt.authority.htmlRoutes} authoritative HTML routes x 2 viewports, ${receipt.authority.articleRoutes} public articles, ${receipt.authority.heldArticleRoutes} held defaults, wallet/private/static controls, build ${receipt.candidate.buildId}, auth configured ${receipt.authConfigured}.`,
  );
}

const isMain =
  process.argv[1] !== undefined &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (isMain) await main();
