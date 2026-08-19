#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  deniedMediaChecks,
  readMediaAuthority,
  representativeMediaChecks,
  runHostedNewsroomMediaDelivery,
  validateMediaAuthority,
} from "./test-hosted-newsroom-media-delivery.mjs";

const authority = validateMediaAuthority(readMediaAuthority());
const byPath = new Map(authority.assets.map((asset) => [asset.path, asset]));
const deniedByPath = new Map(
  deniedMediaChecks(authority).map((check) => [check.path, check]),
);
assert.equal(authority.assets.length, 16);
assert.equal(new Set(authority.assets.map((asset) => asset.path)).size, 16);
assert.deepEqual(
  representativeMediaChecks(authority).map((check) => check.path),
  [
    "/media/verified/areas/downtown-dubai.webp",
    "/media/verified/developers/aldar.webp",
    "/media/real-uhd/raj-tomar-portrait.webp",
  ],
);

const sentinel = "newsroom-protected-preview-secret-19ae";
const baseEnvironment = {
  NEWSROOM_AUDIT_OUTPUT: "outputs/newsroom-hosted-media.json",
  NEWSROOM_BUILD_ID: "azEh_JQ359v7jpcnQ9mB1",
  NEWSROOM_CANDIDATE_SHA: "a".repeat(40),
  NEWSROOM_EXPECT_PROTECTED_PREVIEW: "1",
};

function successfulFetch(calls, expectedAuth = null) {
  return async (input, options = {}) => {
    const url = input instanceof URL ? input : new URL(input);
    const headers = new Headers(options.headers);
    calls.push({
      auth: headers.get("x-vercel-protection-bypass"),
      method: options.method,
      path: url.pathname,
      range: headers.get("range"),
    });
    assert.equal(options.redirect, "manual");
    assert.equal(headers.get("x-vercel-protection-bypass"), expectedAuth);
    if (url.pathname.includes("/_next/static/")) {
      return new Response(null, {
        headers: { "content-type": "application/javascript" },
        status: 200,
      });
    }
    if (deniedByPath.has(url.pathname)) {
      return new Response(null, {
        headers: {
          "cache-control": "private, no-store",
          "content-type": "text/plain; charset=utf-8",
          "x-robots-tag": "noindex, nofollow, noarchive",
        },
        status: 404,
      });
    }
    assert.ok(byPath.has(url.pathname), `Unexpected ${url.pathname}`);
    const responseHeaders = {
      "content-type": "image/webp",
      "x-robots-tag": "noindex, nofollow, noarchive",
    };
    return options.method === "HEAD"
      ? new Response(null, { headers: responseHeaders, status: 200 })
      : new Response(new Uint8Array([1, 2, 3]), {
          headers: { ...responseHeaders, "content-range": "bytes 0-2/3" },
          status: 206,
        });
  };
}

const localEnvironment = {
  ...baseEnvironment,
  NEWSROOM_AUDIT_URL: "http://127.0.0.1:3130",
};
const localCalls = [];
const localReceipt = await runHostedNewsroomMediaDelivery({
  authority,
  environment: localEnvironment,
  fetchImpl: successfulFetch(localCalls),
});
const repeatedReceipt = await runHostedNewsroomMediaDelivery({
  authority,
  environment: localEnvironment,
  fetchImpl: successfulFetch([]),
});
assert.deepEqual(localReceipt, repeatedReceipt, "Receipt must be deterministic");
assert.equal(localReceipt.authConfigured, false);
assert.equal(localReceipt.requests.head.passed, 16);
assert.equal(localReceipt.requests.get.passed, 3);
assert.equal(localReceipt.requests.denied.passed, 51);
assert.equal(localReceipt.requests.total, 71);
assert.equal(localCalls.length, 71);
assert.deepEqual(
  localCalls.filter((call) => call.method === "HEAD").map((call) => call.path),
  [
    `/_next/static/${baseEnvironment.NEWSROOM_BUILD_ID}/_buildManifest.js`,
    ...authority.assets.map((asset) => asset.path),
    ...deniedMediaChecks(authority).map((check) => check.path),
  ],
);

const hostedCalls = [];
const hostedReceipt = await runHostedNewsroomMediaDelivery({
  authority,
  environment: {
    ...baseEnvironment,
    NEWSROOM_AUDIT_URL:
      "https://news-investwithraj-site-abc123xyz-office-2271s-projects.vercel.app",
    NEWSROOM_VERCEL_PROTECTION_BYPASS: sentinel,
  },
  fetchImpl: successfulFetch(hostedCalls, sentinel),
});
assert.equal(hostedReceipt.authConfigured, true);
assert.ok(hostedCalls.every((call) => call.auth === sentinel));
const serialized = JSON.stringify(hostedReceipt);
assert.equal(serialized.includes(sentinel), false);
assert.equal(/token|secret|generatedAt|timestamp|responseBody/iu.test(serialized), false);

for (const maliciousPath of [
  "//outside.invalid/x.webp",
  "/media//x.webp",
  "/media\\x.webp",
  "/media/../x.webp",
  "/media/%2e%2e/x.webp",
  "/media/x.webp?download=1",
  "/media/x.webp#fragment",
]) {
  const changed = structuredClone(authority);
  changed.assets[0].path = maliciousPath;
  let fetches = 0;
  await assert.rejects(
    () =>
      runHostedNewsroomMediaDelivery({
        authority: changed,
        environment: {
          ...baseEnvironment,
          NEWSROOM_AUDIT_URL:
            "https://news-investwithraj-site-abc123xyz-office-2271s-projects.vercel.app",
          NEWSROOM_VERCEL_PROTECTION_BYPASS: sentinel,
        },
        fetchImpl: async () => {
          fetches += 1;
          throw new Error(sentinel);
        },
      }),
    /single-root|empty segment|backslash|dot segment|percent encoding|query or fragment/u,
  );
  assert.equal(fetches, 0, `${maliciousPath} must fail before auth fetch`);
}

for (const mutate of [
  (changed) => {
    changed.dormantMedia[0].path = "//outside.invalid/withheld.mp4";
  },
  (changed) => {
    changed.unknownGovernedMedia[0] = "//outside.invalid/unknown.png";
  },
]) {
  const changed = structuredClone(authority);
  mutate(changed);
  let fetches = 0;
  await assert.rejects(
    () =>
      runHostedNewsroomMediaDelivery({
        authority: changed,
        environment: {
          ...baseEnvironment,
          NEWSROOM_AUDIT_URL:
            "https://news-investwithraj-site-abc123xyz-office-2271s-projects.vercel.app",
          NEWSROOM_VERCEL_PROTECTION_BYPASS: sentinel,
        },
        fetchImpl: async () => {
          fetches += 1;
          throw new Error(sentinel);
        },
      }),
    /single-root/u,
  );
  assert.equal(fetches, 0, "Every manifest cohort must validate before auth fetch");
}

await assert.rejects(
  () =>
    runHostedNewsroomMediaDelivery({
      authority,
      environment: localEnvironment,
      fetchImpl: async () =>
        new Response("<!doctype html>", {
          headers: { "content-type": "text/html" },
          status: 200,
        }),
    }),
  /Build identity must be JavaScript/u,
);
for (const rejectedOrigin of [
  "https://news-preview.vercel.app",
  "https://news-investwithraj-site-abc123xyz-other-team.vercel.app",
  "https://investwithraj-abc123xyz-office-2271s-projects.vercel.app",
  "https://x.vercel.app",
]) {
  let fetches = 0;
  await assert.rejects(
    () =>
      runHostedNewsroomMediaDelivery({
        authority,
        environment: {
          ...baseEnvironment,
          NEWSROOM_AUDIT_URL: rejectedOrigin,
          NEWSROOM_VERCEL_PROTECTION_BYPASS: sentinel,
        },
        fetchImpl: async () => {
          fetches += 1;
          throw new Error(sentinel);
        },
      }),
    /exact immutable newsroom deployment hostname/u,
  );
  assert.equal(fetches, 0, `${rejectedOrigin} must fail before auth fetch`);
}

await assert.rejects(
  () =>
    runHostedNewsroomMediaDelivery({
      authority,
      environment: localEnvironment,
      fetchImpl: async (input) => {
        const url = input instanceof URL ? input : new URL(input);
        if (url.pathname.includes("/_next/static/")) {
          return new Response(null, {
            headers: { "content-type": "application/javascript" },
            status: 200,
          });
        }
        return new Response(null, {
          headers: {
            "content-type": "image/webp",
            "x-robots-tag": "index, noindex, noarchive",
          },
          status: 200,
        });
      },
    }),
  /contradicts noindex with index/u,
);

const source = readFileSync(
  new URL("./test-hosted-newsroom-media-delivery.mjs", import.meta.url),
  "utf8",
);
assert.match(source, /NEWSROOM_PROTECTION_BYPASS_ENV/u);
assert.match(source, /auth\.fetchOptions/u);
assert.doesNotMatch(source, /NEWSROOM_VERCEL_PROTECTION_BYPASS/u);
assert.doesNotMatch(source, /generatedAt|new Date\(/u);
const runtime = source.slice(source.indexOf("export async function runHostedNewsroomMediaDelivery"));
assert.ok(
  runtime.indexOf("validateMediaAuthority") < runtime.indexOf("createProtectedPreviewAuth"),
  "Authority must validate before auth creation",
);

console.log(
  "Hosted newsroom media contract passed: 16 approved HEAD, three class GETs, 51 denied HEAD, exact newsroom host binding, robots, same-origin and secret-free deterministic receipts.",
);
