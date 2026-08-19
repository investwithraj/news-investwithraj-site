#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  parseProviderPreflightConfiguration,
  runHostedNewsroomProviderPreflight,
} from "./test-hosted-newsroom-provider-preflight.mjs";

const providerSentinel = "provider-preflight-secret-109a";
const bypassSentinel = "newsroom-preview-secret-27bd";
const candidateSha = "a".repeat(40);
const productionSha = "b".repeat(40);
const previewBranch = "codex/iwr-newsroom-preview-54c3566";
const productionId = "dpl_Production123";
const previewId = "dpl_Preview123";
const previewSecondId = "dpl_Preview456";
const productionOrigin =
  "https://news-investwithraj-site-def456uvw-office-2271s-projects.vercel.app";
const previewOrigin =
  "https://news-investwithraj-site-abc123xyz-office-2271s-projects.vercel.app";
const productionBuildId = "productionBuild_456";
const previewBuildId = "previewBuild_123";
const environment = {
  NEWSROOM_AUDIT_OUTPUT: "outputs/newsroom-provider-preflight.json",
  NEWSROOM_CANDIDATE_SHA: candidateSha,
  NEWSROOM_PREVIEW_BRANCH: previewBranch,
  NEWSROOM_VERCEL_API_TOKEN: providerSentinel,
  NEWSROOM_VERCEL_PROTECTION_BYPASS: bypassSentinel,
};

function responseWithUrl(body, init, url) {
  const response = new Response(body, init);
  Object.defineProperty(response, "url", { value: url.href });
  return response;
}

function json(value) {
  return new Response(JSON.stringify(value), {
    headers: { "content-type": "application/json" },
    status: 200,
  });
}

function deployment({ aliases, branch, id, origin, sha, target }) {
  return {
    alias: aliases,
    id,
    meta: { gitCommitRef: branch, gitCommitSha: sha },
    ownerId: "team_fX0MDhZugKxOW3rijXKAgYiA",
    projectId: "prj_kfTRKu4x1NZThilS9JTJTFt8S47h",
    readyState: "READY",
    target: target === "preview" ? null : target,
    url: new URL(origin).hostname,
  };
}

function fixtureFetch(
  calls,
  {
    buildIdentity = "normal",
    customPreviewAlias = false,
    previewCanonicalTakeover = false,
    previewCount = 1,
  } = {},
) {
  const production = deployment({
    aliases: ["news.investwithraj.com"],
    branch: "main",
    id: productionId,
    origin: productionOrigin,
    sha: productionSha,
    target: "production",
  });
  const previewAliases = previewCanonicalTakeover
    ? ["news.investwithraj.com"]
    : customPreviewAlias
      ? ["preview.example.com"]
      : [
          "news-investwithraj-site-git-proposed-office-2271s-projects.vercel.app",
        ];
  const preview = deployment({
    aliases: previewAliases,
    branch: previewBranch,
    id: previewId,
    origin: previewOrigin,
    sha: candidateSha,
    target: "preview",
  });
  return async (input, options = {}) => {
    const url = input instanceof URL ? input : new URL(input);
    const headers = new Headers(options.headers);
    const authorization = headers.get("authorization");
    const bypass = headers.get("x-vercel-protection-bypass");
    calls.push({ authorization, bypass, method: options.method ?? "GET", origin: url.origin, path: url.pathname });
    assert.equal(options.redirect, "manual");
    if (url.origin === "https://api.vercel.com") {
      assert.equal(authorization, `Bearer ${providerSentinel}`);
      assert.equal(bypass, null, "Newsroom bypass must not reach provider API");
      assert.equal(url.searchParams.get("teamId"), "team_fX0MDhZugKxOW3rijXKAgYiA");
      if (url.pathname.startsWith("/v9/projects/")) {
        return json({
          accountId: "team_fX0MDhZugKxOW3rijXKAgYiA",
          autoAssignCustomDomains: true,
          framework: "nextjs",
          gitForkProtection: true,
          id: "prj_kfTRKu4x1NZThilS9JTJTFt8S47h",
          link: {
            org: "investwithraj",
            productionBranch: "main",
            repo: "news-investwithraj-site",
            repoId: 1248443593,
            type: "github",
          },
          name: "news-investwithraj-site",
          nodeVersion: "24.x",
          protectionBypass: { current: {} },
          ssoProtection: { deploymentType: "all_except_custom_domains" },
          targets: { production: { id: productionId } },
        });
      }
      if (url.pathname.endsWith("/env")) {
        assert.equal(url.searchParams.get("limit"), "100");
        return url.searchParams.has("until")
          ? json({ envs: [{ key: "SECOND_KEY", target: ["preview"], type: "plain" }] })
          : json({
              envs: [{ key: "FIRST_KEY", target: ["production"], type: "plain" }],
              pagination: { next: 123 },
            });
      }
      if (url.pathname === "/v6/deployments") {
        assert.equal(url.searchParams.get("projectId"), "prj_kfTRKu4x1NZThilS9JTJTFt8S47h");
        assert.equal(url.searchParams.get("target"), "preview");
        assert.equal(url.searchParams.get("state"), "READY");
        assert.equal(url.searchParams.get("limit"), "100");
        const candidates = previewCount === 0
          ? []
          : [
              preview,
              ...(previewCount === 2
                ? [{ ...preview, id: previewSecondId, url: "news-investwithraj-site-ghi789rst-office-2271s-projects.vercel.app" }]
                : []),
            ];
        return json({ deployments: candidates });
      }
      if (url.pathname.endsWith(productionId)) return json(production);
      if (url.pathname.endsWith(previewId)) return json(preview);
      throw new Error(`Unexpected provider request ${url.href}`);
    }

    assert.equal(authorization, null, "Provider credential escaped Vercel API");
    assert.ok([productionOrigin, previewOrigin].includes(url.origin), `Unexpected app origin ${url.origin}`);
    if (bypass === null) {
      return responseWithUrl(null, {
        headers: {
          location: `https://vercel.com/sso-api?url=${encodeURIComponent(url.href)}`,
          "x-robots-tag": "noindex",
        },
        status: 302,
      }, url);
    }
    assert.equal(bypass, bypassSentinel);
    const buildId = url.origin === productionOrigin ? productionBuildId : previewBuildId;
    if (url.pathname === "/") {
      const buildMarkup =
        buildIdentity === "missing"
          ? ""
          : buildIdentity === "multiple"
            ? `<script src="/_next/static/${buildId}/_buildManifest.js"></script><script src="/_next/static/otherBuild_789/_ssgManifest.js"></script>`
            : `<script src="/_next/static/${buildId}/_buildManifest.js"></script>`;
      return responseWithUrl(`<!doctype html><html><body><h1>News</h1>${buildMarkup}</body></html>`, {
        headers: { "content-type": "text/html", "x-robots-tag": "noindex, nofollow" },
        status: 200,
      }, url);
    }
    assert.equal(url.pathname, `/_next/static/${buildId}/_buildManifest.js`);
    return responseWithUrl(null, {
      headers: { "content-type": "application/javascript" },
      status: 200,
    }, url);
  };
}

const calls = [];
const receipt = await runHostedNewsroomProviderPreflight({
  environment,
  fetchImpl: fixtureFetch(calls),
});
const repeated = await runHostedNewsroomProviderPreflight({
  environment,
  fetchImpl: fixtureFetch([]),
});
assert.deepEqual(receipt, repeated, "Provider preflight receipt must be deterministic");
assert.equal(receipt.production.id, productionId);
assert.equal(receipt.production.buildId, productionBuildId);
assert.equal(receipt.preview.id, previewId);
assert.equal(receipt.preview.buildId, previewBuildId);
assert.equal(receipt.preview.source.sha, candidateSha);
assert.equal(receipt.environmentKeys.length, 2, "Provider env pagination must be complete");
assert.equal(receipt.providerRequests, 6);
assert.equal(calls.length, 12);
assert.equal(calls.filter((call) => call.authorization !== null).length, 6);
assert.equal(calls.filter((call) => call.bypass !== null).length, 4);
assert.ok(calls.filter((call) => call.origin !== "https://api.vercel.com").every((call) => call.authorization === null));
assert.ok(calls.filter((call) => call.origin === "https://api.vercel.com").every((call) => call.bypass === null));
const serialized = JSON.stringify(receipt);
assert.equal(serialized.includes(providerSentinel), false);
assert.equal(serialized.includes(bypassSentinel), false);
assert.equal(/generatedAt|timestamp|responseBody/iu.test(serialized), false);

for (const previewCount of [0, 2]) {
  await assert.rejects(
    () => runHostedNewsroomProviderPreflight({ environment, fetchImpl: fixtureFetch([], { previewCount }) }),
    new RegExp(`found ${previewCount}`, "u"),
  );
}
await assert.rejects(
  () => runHostedNewsroomProviderPreflight({ environment, fetchImpl: fixtureFetch([], { customPreviewAlias: true }) }),
  /not an exact newsroom project\/team Vercel hostname/u,
);
await assert.rejects(
  () => runHostedNewsroomProviderPreflight({ environment, fetchImpl: fixtureFetch([], { previewCanonicalTakeover: true }) }),
  /not an exact newsroom project\/team Vercel hostname/u,
);
for (const buildIdentity of ["missing", "multiple"]) {
  await assert.rejects(
    () => runHostedNewsroomProviderPreflight({ environment, fetchImpl: fixtureFetch([], { buildIdentity }) }),
    /Served HTML must expose exactly one Next build ID/u,
  );
}
assert.throws(
  () => parseProviderPreflightConfiguration({ ...environment, NEWSROOM_CANDIDATE_SHA: "fabricated" }),
  /Invalid candidate SHA/u,
);

const source = readFileSync(new URL("./test-hosted-newsroom-provider-preflight.mjs", import.meta.url), "utf8");
assert.doesNotMatch(source, /generatedAt|new Date\(/u);
assert.doesNotMatch(source, /[?&](?:x-vercel-protection-bypass|set-bypass-cookie)=/iu);

console.log(
  "Hosted newsroom provider preflight contract passed: unique SHA/branch discovery, complete env metadata, strict aliases, remote build identity and zero credential spray.",
);
