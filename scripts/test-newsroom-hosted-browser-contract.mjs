#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  EXPECTED_CANDIDATE_SHA,
  EXPECTED_GENERATED_PAGES,
  EXPECTED_HTML_AUTHORITY_ROUTES,
  EXPECTED_NOT_FOUND_ROUTES,
  EXPECTED_PRIVATE_ROUTES,
  EXPECTED_PUBLIC_ARTICLES,
  EXPECTED_SITEMAP_ROUTES,
  EXPECTED_STATIC_ROUTES,
  EXPECTED_VIEWPORT_CASES,
  buildHostedBrowserReceipt,
  buildHtmlRouteAuthority,
  createOriginScopedRequestClient,
  heldArticlePaths,
  installOriginScopedBrowserAuth,
  navigationIdentityProblems,
  originScopedRequestHeaders,
  parseArchiveArticlePaths,
  parseHostedBrowserConfiguration,
  parseSitemapPaths,
  runNewsroomHostedBrowserGate,
} from "./test-newsroom-hosted-browser.mjs";
import {
  NEWSROOM_PROTECTION_BYPASS_ENV,
  createProtectedPreviewAuth,
} from "./lib/protected-preview-auth.mjs";

const runtimeReceipt = JSON.parse(
  readFileSync(
    new URL("../outputs/newsroom-runtime-ae9be86/default.json", import.meta.url),
    "utf8",
  ),
);
assert.equal(
  EXPECTED_CANDIDATE_SHA,
  "54c35668f90dcdf696785c6fd5cc6e67a268e866",
  "Hosted browser gate must remain pinned to the media-policy runtime candidate",
);
const sitemapXml = `<?xml version="1.0"?><urlset>${runtimeReceipt.discovery.sitemap.paths
  .map((routePath) => `<url><loc>https://news.investwithraj.com${routePath}</loc></url>`)
  .join("")}</urlset>`;
const articleUrls = runtimeReceipt.discovery.newsArchive.articleSlugs.map(
  (slug) => `https://news.investwithraj.com/news/${slug}`,
);
const archiveHtml = `<html><head><script type="application/ld+json">${JSON.stringify({
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "ItemList",
      itemListElement: articleUrls.map((url, index) => ({
        "@type": "ListItem",
        position: index + 1,
        url,
      })),
    },
  ],
})}</script></head><body></body></html>`;

const sitemapPaths = parseSitemapPaths(sitemapXml);
const articlePaths = parseArchiveArticlePaths(archiveHtml);
const routes = buildHtmlRouteAuthority(sitemapPaths, articlePaths);
const heldPaths = heldArticlePaths();

assert.equal(EXPECTED_GENERATED_PAGES, 98);
assert.equal(sitemapPaths.length, EXPECTED_SITEMAP_ROUTES);
assert.equal(articlePaths.length, EXPECTED_PUBLIC_ARTICLES);
assert.equal(routes.length, EXPECTED_HTML_AUTHORITY_ROUTES);
assert.equal(new Set(routes.map((route) => route.path)).size, routes.length);
assert.equal(articlePaths.filter((articlePath) => !sitemapPaths.includes(articlePath)).length, 1);
assert.equal(heldPaths.length, 24);
assert.ok(heldPaths.every((heldPath) => articlePaths.includes(heldPath)));
assert.deepEqual(
  routes.filter((route) => route.noindex).map((route) => route.path),
  ["/ask", "/closing-bell", "/power-list/2026", "/pulse", "/spatial"],
);

const baseEnvironment = {
  IWR_EXPECT_NEWSROOM_PROTECTED_PREVIEW: "1",
  IWR_NEWS_AUDIT_OUTPUT: "outputs/newsroom-hosted-preview/report.json",
  IWR_NEWS_AUDIT_URL: "http://127.0.0.1:44100",
  IWR_NEWS_BUILD_ID: "newsroomBuild_123",
  IWR_NEWS_CANDIDATE_SHA: EXPECTED_CANDIDATE_SHA,
};
const config = parseHostedBrowserConfiguration(baseEnvironment);
assert.equal(config.hosted, false);
assert.equal(config.candidateSha, EXPECTED_CANDIDATE_SHA);
assert.equal(config.auditUrl, "http://127.0.0.1:44100");

const sentinel = "newsroom-hosted-browser-secret-7a13";
const hostedOrigin =
  "https://news-investwithraj-site-abc123xyz-office-2271s-projects.vercel.app";
const scopedAuth = createProtectedPreviewAuth(NEWSROOM_PROTECTION_BYPASS_ENV, {
  NEWSROOM_VERCEL_PROTECTION_BYPASS: sentinel,
});
const firstPartyHeaders = originScopedRequestHeaders(
  scopedAuth,
  `${hostedOrigin}/news`,
  hostedOrigin,
  { "x-existing": "retained" },
);
assert.equal(firstPartyHeaders["x-vercel-protection-bypass"], sentinel);
assert.equal(firstPartyHeaders["x-existing"], "retained");
const externalHeaders = originScopedRequestHeaders(
  scopedAuth,
  "https://images.example.invalid/cover.webp",
  hostedOrigin,
  {
    "x-existing": "retained",
    "x-vercel-protection-bypass": sentinel,
  },
);
assert.equal(externalHeaders["x-vercel-protection-bypass"], undefined);
assert.equal(externalHeaders["x-existing"], "retained");

const requestClientCalls = [];
const requestClient = createOriginScopedRequestClient(
  scopedAuth,
  hostedOrigin,
  async (input, options) => {
    const url = input instanceof URL ? input : new URL(input);
    requestClientCalls.push({
      auth: new Headers(options.headers).get("x-vercel-protection-bypass"),
      redirect: options.redirect,
      url: url.href,
    });
    const response = new Response("ok", { status: 200 });
    Object.defineProperty(response, "url", { value: url.href });
    return response;
  },
);
const requestClientResponse = await requestClient.get(`${hostedOrigin}/robots.txt`);
assert.equal(requestClientResponse.status(), 200);
assert.deepEqual(requestClientCalls, [
  { auth: sentinel, redirect: "manual", url: `${hostedOrigin}/robots.txt` },
]);
await assert.rejects(
  () => requestClient.get("https://external.example.invalid/robots.txt"),
  /escaped the exact audit origin/u,
);
assert.equal(requestClientCalls.length, 1);
assert.equal(JSON.stringify(requestClient).includes(sentinel), false);

let interceptHandler;
await installOriginScopedBrowserAuth(
  {
    async route(pattern, handler) {
      assert.equal(pattern, "**/*");
      interceptHandler = handler;
    },
  },
  scopedAuth,
  hostedOrigin,
);
const intercepted = [];
function fakeRoute(url, fetchedResponse = { marker: "response" }) {
  return {
    async continue(options) {
      intercepted.push({ kind: "continue", options, url });
    },
    async fetch(options) {
      intercepted.push({ kind: "fetch", options, url });
      return fetchedResponse;
    },
    async fulfill(options) {
      intercepted.push({ kind: "fulfill", options, url });
    },
    request() {
      return { headers: () => ({ accept: "text/html" }), url: () => url };
    },
  };
}
await interceptHandler(fakeRoute(`${hostedOrigin}/news`));
await interceptHandler(fakeRoute("https://cdn.example.invalid/image.webp"));
const redirectResponse = {
  headers: () => ({ location: "https://redirect.example.invalid/landing" }),
  status: () => 302,
};
await interceptHandler(fakeRoute(`${hostedOrigin}/redirect`, redirectResponse));
await interceptHandler(fakeRoute("https://redirect.example.invalid/landing"));
const scopedFetch = intercepted.find((call) => call.kind === "fetch");
assert.equal(scopedFetch.options.maxRedirects, 0);
assert.equal(scopedFetch.options.headers["x-vercel-protection-bypass"], sentinel);
const externalContinue = intercepted.find(
  (call) => call.kind === "continue" && call.url.includes("cdn.example.invalid"),
);
assert.equal(externalContinue.options.headers["x-vercel-protection-bypass"], undefined);
assert.equal(
  intercepted.some(
    (call) =>
      call.url.includes("cdn.example.invalid") &&
      call.options?.headers?.["x-vercel-protection-bypass"] === sentinel,
  ),
  false,
);
const redirectFetch = intercepted.find(
  (call) => call.kind === "fetch" && call.url === `${hostedOrigin}/redirect`,
);
assert.equal(redirectFetch.options.maxRedirects, 0);
assert.equal(redirectFetch.options.headers["x-vercel-protection-bypass"], sentinel);
const redirectedExternal = intercepted.find(
  (call) => call.kind === "continue" && call.url.includes("redirect.example.invalid"),
);
assert.equal(
  redirectedExternal.options.headers["x-vercel-protection-bypass"],
  undefined,
  "A cross-origin redirect destination must never receive the bypass",
);

assert.deepEqual(
  navigationIdentityProblems({
    pageUrl: `${hostedOrigin}/news`,
    redirected: false,
    requestedUrl: `${hostedOrigin}/news`,
    responseUrl: `${hostedOrigin}/news`,
  }),
  [],
);
assert.deepEqual(
  navigationIdentityProblems({
    pageUrl: `${hostedOrigin}/news/`,
    redirected: true,
    requestedUrl: `${hostedOrigin}/news`,
    responseUrl: `${hostedOrigin}/news/`,
  }),
  [
    "navigation redirected",
    `response URL ${hostedOrigin}/news/`,
    `page URL ${hostedOrigin}/news/`,
  ],
);

const routeResults = ["desktop", "mobile"].flatMap((viewport) =>
  routes.map((route) => ({ path: route.path, problems: [], status: 200, viewport })),
);
const receiptInput = {
  articlePaths,
  authConfigured: true,
  buildAssetStatus: 200,
  buildPath: `/_next/static/${baseEnvironment.IWR_NEWS_BUILD_ID}/_buildManifest.js`,
  config,
  endpointResults: [
    "/0d6e3835646ccbe5dba5ed6ab2646308.txt",
    "/icon.svg",
    "/llms.txt",
    "/news-sitemap.xml",
    "/robots.txt",
    "/rss.xml",
    "/sitemap.xml",
  ].map((path) => ({ path, status: 200 })),
  findings: [],
  heldPaths,
  notFoundResults: ["/wallet", "/news/not-a-route", `${heldPaths[0]}/extra`].map(
    (path) => ({ path, status: 404 }),
  ),
  privateResults: ["/internal/dashboard", "/internal/review"].map((path) => ({
    path,
    status: 401,
  })),
  routeResults,
  routes,
  sitemapPaths,
};
const receipt = buildHostedBrowserReceipt(receiptInput);
const repeatedReceipt = buildHostedBrowserReceipt(structuredClone(receiptInput));
assert.deepEqual(receipt, repeatedReceipt);
assert.equal(JSON.stringify(receipt), JSON.stringify(repeatedReceipt));
assert.equal(receipt.authority.viewportCases, EXPECTED_VIEWPORT_CASES);
assert.equal(receipt.controls.static.length, EXPECTED_STATIC_ROUTES);
assert.equal(receipt.controls.private.length, EXPECTED_PRIVATE_ROUTES);
assert.equal(receipt.controls.notFound.length, EXPECTED_NOT_FOUND_ROUTES);
assert.equal(JSON.stringify(receipt).includes(sentinel), false);
assert.equal(/token|secret|generatedAt|timestamp/iu.test(JSON.stringify(receipt)), false);
assert.throws(
  () =>
    buildHostedBrowserReceipt({
      ...receiptInput,
      routeResults: routeResults.slice(1),
    }),
  /170/u,
);

assert.throws(
  () =>
    parseHostedBrowserConfiguration({
      ...baseEnvironment,
      IWR_NEWS_CANDIDATE_SHA: "a".repeat(40),
    }),
  /certified newsroom runtime SHA/u,
);
assert.throws(
  () =>
    parseHostedBrowserConfiguration({
      ...baseEnvironment,
      IWR_NEWS_AUDIT_URL: `${hostedOrigin}/path`,
    }),
  /origin URL/u,
);
assert.throws(
  () =>
    parseHostedBrowserConfiguration({
      ...baseEnvironment,
      IWR_NEWS_AUDIT_URL: `https://user:secret@${new URL(hostedOrigin).hostname}`,
    }),
  /must not contain credentials/u,
);
assert.throws(
  () =>
    parseHostedBrowserConfiguration({
      ...baseEnvironment,
      IWR_NEWS_AUDIT_URL: "ftp://127.0.0.1:44100",
    }),
  /must use HTTP or HTTPS/u,
);
assert.throws(
  () =>
    parseHostedBrowserConfiguration({
      ...baseEnvironment,
      IWR_EXPECT_NEWSROOM_PROTECTED_PREVIEW: "0",
    }),
  /must equal 1/u,
);

for (const invalidOrigin of [
  "https://news-preview.vercel.app",
  "https://news-investwithraj-site-abc123xyz-other-team.vercel.app",
  "https://investwithraj-site-abc123xyz-office-2271s-projects.vercel.app",
]) {
  let credentialReads = 0;
  let invalidOriginFetches = 0;
  const invalidEnvironment = {
    ...baseEnvironment,
    IWR_NEWS_AUDIT_URL: invalidOrigin,
  };
  Object.defineProperty(invalidEnvironment, "NEWSROOM_VERCEL_PROTECTION_BYPASS", {
    enumerable: true,
    get() {
      credentialReads += 1;
      return sentinel;
    },
  });
  await assert.rejects(
    () =>
      runNewsroomHostedBrowserGate({
        environment: invalidEnvironment,
        fetchImpl: async () => {
          invalidOriginFetches += 1;
          throw new Error("Invalid origin reached fetch");
        },
      }),
    /exact immutable newsroom deployment hostname/u,
  );
  assert.equal(credentialReads, 0, `${invalidOrigin} read auth before host validation`);
  assert.equal(invalidOriginFetches, 0, `${invalidOrigin} reached fetch`);
}

let unauthenticatedFetches = 0;
await assert.rejects(
  () =>
    runNewsroomHostedBrowserGate({
      environment: {
        ...baseEnvironment,
        IWR_NEWS_AUDIT_URL: hostedOrigin,
      },
      fetchImpl: async () => {
        unauthenticatedFetches += 1;
        throw new Error("Fetch must not run without hosted auth");
      },
    }),
  /requires protection auth/u,
);
assert.equal(unauthenticatedFetches, 0);

assert.throws(
  () => parseSitemapPaths(sitemapXml.replace("news.investwithraj.com", "preview.vercel.app")),
  /Sitemap URL host drifted/u,
);
assert.throws(
  () => parseArchiveArticlePaths(archiveHtml.replace("ItemList", "CollectionPage")),
  /one ItemList authority/u,
);

const hostedSource = readFileSync(
  new URL("./test-newsroom-hosted-browser.mjs", import.meta.url),
  "utf8",
);
const batch8Source = readFileSync(new URL("./audit-batch-8.mjs", import.meta.url), "utf8");
const batch9Source = readFileSync(new URL("./audit-batch-9.mjs", import.meta.url), "utf8");

assert.match(hostedSource, /createProtectedPreviewAuth/u);
assert.match(hostedSource, /NEWSROOM_PROTECTION_BYPASS_ENV/u);
assert.match(hostedSource, /auth\.fetchOptions/u);
assert.match(hostedSource, /installOriginScopedBrowserAuth/u);
assert.match(hostedSource, /maxRedirects:\s*0/u);
assert.doesNotMatch(hostedSource, /auth\.browserContextOptions/u);
assert.match(hostedSource, /EXPECTED_GENERATED_PAGES = 98/u);
assert.match(hostedSource, /EXPECTED_SITEMAP_ROUTES = 79/u);
assert.match(hostedSource, /EXPECTED_PUBLIC_ARTICLES = 41/u);
assert.match(hostedSource, /EXPECTED_HTML_AUTHORITY_ROUTES = 85/u);
assert.match(hostedSource, /IMMUTABLE_NEWSROOM_HOST/u);
assert.match(hostedSource, /0d6e3835646ccbe5dba5ed6ab2646308\.txt/u);
assert.match(hostedSource, /"\/icon\.svg"/u);
assert.match(hostedSource, /\[401, 403, 503\]/u);
assert.match(hostedSource, /"\/wallet"/u);
assert.match(hostedSource, /authConfigured: auth\.authConfigured/u);
assert.doesNotMatch(hostedSource, /NEWSROOM_VERCEL_PROTECTION_BYPASS/u);
assert.doesNotMatch(hostedSource, /generatedAt|new Date\(/u);
assert.doesNotMatch(hostedSource, /\/api\//u, "Hosted gate must not call mutation/API routes");
assert.doesNotMatch(
  hostedSource,
  /[?&](?:x-vercel-protection-bypass|set-bypass-cookie)=/iu,
);

assert.match(batch8Source, /current 41 public article routes/u);
assert.match(batch8Source, /default sitemap contains 79 unique public routes/u);
assert.doesNotMatch(batch8Source, /newsUrls\.length === 38|38 live report routes/u);
assert.ok(
  batch8Source.includes('requestClient.get(`${BASE_URL}${routePath}`)'),
  "Batch 8 must audit article paths against the configured newsroom origin",
);
for (const [label, source] of [
  ["Batch 8", batch8Source],
  ["Batch 9", batch9Source],
]) {
  assert.match(source, /installOriginScopedBrowserAuth/u, `${label} lacks scoped browser auth`);
  assert.match(source, /createOriginScopedRequestClient/u, `${label} lacks scoped requests`);
  assert.doesNotMatch(source, /\.browserContextOptions/u, `${label} uses global auth`);
  assert.doesNotMatch(source, /maxRedirects:\s*5/u, `${label} follows redirects`);
  assert.doesNotMatch(source, /context\.request/u, `${label} bypasses scoped requests`);
}
const batch9Routes = batch9Source.slice(
  batch9Source.indexOf("const ROUTES ="),
  batch9Source.indexOf("const VIEWPORTS ="),
);
assert.doesNotMatch(batch9Routes, /path:\s*"\/wallet"/u);
assert.match(batch9Source, /\/wallet remains an intentional public 404/u);
assert.match(batch9Source, /walletPage\.status\(\) === 404/u);

console.log(
  "Newsroom hosted browser contract PASS: 98-page build expectation, 85 routes/170 viewport cases, 7 static, 2 private and 3 not-found controls, origin-scoped protected auth and deterministic secret-free receipts.",
);
