import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { inspect } from "node:util";

import {
  ADVISORY_PROTECTION_BYPASS_ENV,
  NEWSROOM_PROTECTION_BYPASS_ENV,
  PROTECTION_BYPASS_HEADER,
  createProtectedPreviewAuth,
} from "./lib/protected-preview-auth.mjs";
import {
  createOriginScopedRequestClient,
  installOriginScopedBrowserAuth,
  originScopedRequestHeaders,
} from "./test-newsroom-hosted-browser.mjs";

const newsSecret = "newsroom-preview-secret-43bdf1";
const advisorySecret = "advisory-preview-secret-7ca920";
const baseOptions = { viewport: { width: 390, height: 844 } };
const disabled = createProtectedPreviewAuth(NEWSROOM_PROTECTION_BYPASS_ENV, {});

assert.equal(disabled.authConfigured, false);
assert.equal(disabled.browserContextOptions(baseOptions), baseOptions);
assert.equal(disabled.fetchOptions(baseOptions), baseOptions);

const environment = {
  [NEWSROOM_PROTECTION_BYPASS_ENV]: newsSecret,
  [ADVISORY_PROTECTION_BYPASS_ENV]: advisorySecret,
};
const newsroom = createProtectedPreviewAuth(
  NEWSROOM_PROTECTION_BYPASS_ENV,
  environment,
);
const advisory = createProtectedPreviewAuth(
  ADVISORY_PROTECTION_BYPASS_ENV,
  environment,
);
const newsOptions = newsroom.browserContextOptions({
  extraHTTPHeaders: {
    "x-existing-contract": "retained",
    "X-Vercel-Protection-Bypass": "superseded",
  },
});
const advisoryOptions = advisory.browserContextOptions();

assert.equal(newsroom.authConfigured, true);
assert.equal(advisory.authConfigured, true);
assert.deepEqual(newsOptions.extraHTTPHeaders, {
  "x-existing-contract": "retained",
  [PROTECTION_BYPASS_HEADER]: newsSecret,
});
assert.equal(advisoryOptions.extraHTTPHeaders[PROTECTION_BYPASS_HEADER], advisorySecret);
assert.notEqual(
  newsOptions.extraHTTPHeaders[PROTECTION_BYPASS_HEADER],
  advisoryOptions.extraHTTPHeaders[PROTECTION_BYPASS_HEADER],
);

const fetchOptions = newsroom.fetchOptions({
  cache: "no-store",
  headers: { "x-existing-contract": "retained" },
});
assert.equal(fetchOptions.cache, "no-store");
assert.equal(fetchOptions.headers.get("x-existing-contract"), "retained");
assert.equal(fetchOptions.headers.get(PROTECTION_BYPASS_HEADER), newsSecret);

for (const auth of [newsroom, advisory]) {
  assert.equal(JSON.stringify(auth), '{"authConfigured":true}');
  assert.equal(inspect(auth).includes(newsSecret), false);
  assert.equal(inspect(auth).includes(advisorySecret), false);
}

for (const environmentName of [
  NEWSROOM_PROTECTION_BYPASS_ENV,
  ADVISORY_PROTECTION_BYPASS_ENV,
]) {
  for (const invalidValue of [
    "",
    "   ",
    " leading",
    "trailing ",
    "line\nbreak",
    "carriage\rreturn",
    "tab\tcharacter",
    "null\u0000character",
    "delete\u007fcharacter",
  ]) {
    assert.throws(
      () => createProtectedPreviewAuth(environmentName, { [environmentName]: invalidValue }),
      (error) => {
        assert.ok(
          [
            `${environmentName} must be a non-empty string`,
            `${environmentName} must not contain surrounding whitespace or control characters`,
          ].includes(error.message),
        );
        return true;
      },
    );
  }
}

assert.throws(
  () => createProtectedPreviewAuth("UNREVIEWED_SECRET", environment),
  /Unknown protected-Preview credential scope/u,
);
assert.throws(
  () =>
    createProtectedPreviewAuth(NEWSROOM_PROTECTION_BYPASS_ENV, {
      [NEWSROOM_PROTECTION_BYPASS_ENV]: 42,
    }),
  /NEWSROOM_VERCEL_PROTECTION_BYPASS must be a non-empty string/u,
);

const targetScripts = [
  "scripts/audit-batch-8.mjs",
  "scripts/audit-batch-9.mjs",
  "scripts/test-newsroom-removal-runtime.mjs",
];
for (const scriptPath of targetScripts) {
  const source = readFileSync(new URL(`../${scriptPath}`, import.meta.url), "utf8");
  assert.match(source, /createProtectedPreviewAuth/u, `${scriptPath} helper import`);
  assert.doesNotMatch(
    source,
    /NEWSROOM_VERCEL_PROTECTION_BYPASS|IWR_VERCEL_PROTECTION_BYPASS/u,
    `${scriptPath} must not read credential values directly`,
  );
  assert.doesNotMatch(
    source,
    /[?&](?:x-vercel-protection-bypass|set-bypass-cookie)=/iu,
    `${scriptPath} must not put credentials in URLs`,
  );
}

const batch8 = readFileSync(new URL("./audit-batch-8.mjs", import.meta.url), "utf8");
assert.match(batch8, /installOriginScopedBrowserAuth\(context, newsroomAuth, BASE_URL\)/u);
assert.match(batch8, /createOriginScopedRequestClient\(newsroomAuth, BASE_URL\)/u);
assert.doesNotMatch(batch8, /\.browserContextOptions|extraHTTPHeaders/u);
assert.doesNotMatch(batch8, /context\.request|maxRedirects:\s*5/u);
assert.match(batch8, /authConfigured:\s*newsroomAuth\.authConfigured/u);

const batch9 = readFileSync(new URL("./audit-batch-9.mjs", import.meta.url), "utf8");
assert.match(
  batch9,
  /installOriginScopedBrowserAuth\(context, newsroomAuth, NEWS_BASE\)/u,
);
assert.match(
  batch9,
  /createOriginScopedRequestClient\(\s*newsroomAuth,\s*NEWS_BASE,?\s*\)/u,
);
assert.match(
  batch9,
  /createOriginScopedRequestClient\(\s*advisoryAuth,\s*ADVISORY_BASE,?\s*\)/u,
  "Batch 9 must create a distinct advisory request client",
);
assert.match(
  batch9,
  /advisoryRequestClient\.get\(`\$\{ADVISORY_BASE\}\/media`\)/u,
);
assert.doesNotMatch(batch9, /\.browserContextOptions|extraHTTPHeaders/u);
assert.doesNotMatch(batch9, /context\.request|maxRedirects:\s*5/u);
assert.doesNotMatch(
  batch9,
  /newsroomRequestClient\.get\(`\$\{ADVISORY_BASE\}/u,
  "The newsroom-authenticated client must never request the advisory origin",
);
assert.match(
  batch9,
  /authConfigured:\s*\{\s*newsroom:\s*newsroomAuth\.authConfigured,\s*advisory:\s*advisoryAuth\.authConfigured/u,
);

const removal = readFileSync(
  new URL("./test-newsroom-removal-runtime.mjs", import.meta.url),
  "utf8",
);
assert.match(removal, /newsroomAuth\.fetchOptions/u);

const hostedBrowser = readFileSync(
  new URL("./test-newsroom-hosted-browser.mjs", import.meta.url),
  "utf8",
);
assert.match(hostedBrowser, /installOriginScopedBrowserAuth/u);
assert.match(hostedBrowser, /maxRedirects:\s*0/u);
assert.doesNotMatch(hostedBrowser, /auth\.browserContextOptions/u);

const newsroomOrigin =
  "https://news-investwithraj-site-abc123xyz-office-2271s-projects.vercel.app";
const advisoryOrigin =
  "https://investwithraj-abc123xyz-office-2271s-projects.vercel.app";
const newsroomHeaders = originScopedRequestHeaders(
  newsroom,
  `${newsroomOrigin}/news`,
  newsroomOrigin,
  { "x-existing-contract": "retained" },
);
assert.equal(newsroomHeaders[PROTECTION_BYPASS_HEADER], newsSecret);
assert.equal(newsroomHeaders["x-existing-contract"], "retained");
const externalHeaders = originScopedRequestHeaders(
  newsroom,
  "https://external.example.invalid/asset.webp",
  newsroomOrigin,
  { [PROTECTION_BYPASS_HEADER]: newsSecret },
);
assert.equal(externalHeaders[PROTECTION_BYPASS_HEADER], undefined);

let routeHandler;
await installOriginScopedBrowserAuth(
  {
    async route(pattern, handler) {
      assert.equal(pattern, "**/*");
      routeHandler = handler;
    },
  },
  newsroom,
  newsroomOrigin,
);
const routeCalls = [];
function fakeRoute(url) {
  return {
    async continue(options) {
      routeCalls.push({ kind: "continue", options, url });
    },
    async fetch(options) {
      routeCalls.push({ kind: "fetch", options, url });
      return { marker: "response" };
    },
    async fulfill(options) {
      routeCalls.push({ kind: "fulfill", options, url });
    },
    request() {
      return {
        headers: () => ({ [PROTECTION_BYPASS_HEADER]: "untrusted" }),
        url: () => url,
      };
    },
  };
}
await routeHandler(fakeRoute(`${newsroomOrigin}/news`));
await routeHandler(fakeRoute("https://external.example.invalid/asset.webp"));
const firstPartyFetch = routeCalls.find((call) => call.kind === "fetch");
assert.equal(firstPartyFetch.options.maxRedirects, 0);
assert.equal(firstPartyFetch.options.headers[PROTECTION_BYPASS_HEADER], newsSecret);
const externalContinue = routeCalls.find((call) => call.kind === "continue");
assert.equal(
  externalContinue.options.headers[PROTECTION_BYPASS_HEADER],
  undefined,
);

const requestCalls = [];
function exactFetch(expectedOrigin, expectedSecret) {
  return async (input, options) => {
    const url = input instanceof URL ? input : new URL(input);
    requestCalls.push({
      auth: new Headers(options.headers).get(PROTECTION_BYPASS_HEADER),
      origin: url.origin,
      redirect: options.redirect,
    });
    assert.equal(url.origin, expectedOrigin);
    assert.equal(options.redirect, "manual");
    assert.equal(
      new Headers(options.headers).get(PROTECTION_BYPASS_HEADER),
      expectedSecret,
    );
    const response = new Response("ok", { status: 200 });
    Object.defineProperty(response, "url", { value: url.href });
    return response;
  };
}
const newsroomClient = createOriginScopedRequestClient(
  newsroom,
  newsroomOrigin,
  exactFetch(newsroomOrigin, newsSecret),
);
const advisoryClient = createOriginScopedRequestClient(
  advisory,
  advisoryOrigin,
  exactFetch(advisoryOrigin, advisorySecret),
);
assert.equal((await newsroomClient.get(`${newsroomOrigin}/robots.txt`)).status(), 200);
assert.equal((await advisoryClient.get(`${advisoryOrigin}/media`)).status(), 200);
assert.deepEqual(
  requestCalls.map((call) => call.auth),
  [newsSecret, advisorySecret],
);
await assert.rejects(
  () => newsroomClient.get(`${advisoryOrigin}/media`),
  /escaped the exact audit origin/u,
);
assert.equal(requestCalls.length, 2);

const serializedTopology = JSON.stringify({
  advisory,
  advisoryClient,
  newsroom,
  newsroomClient,
});
assert.equal(serializedTopology.includes(newsSecret), false);
assert.equal(serializedTopology.includes(advisorySecret), false);

console.log(
  "Newsroom protected-Preview auth PASS: origin-scoped headers, fail-closed validation, no-env compatibility and complete redaction.",
);
