#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  capturePublicProductionIdentities,
  parseInvarianceConfiguration,
  runHostedNewsroomInvariance,
} from "./test-hosted-newsroom-invariance.mjs";

const bypassSentinel = "newsroom-invariance-secret-87d1";
const providerSentinel = "vercel-provider-secret-18f0";
const publicOrigin = "https://news.investwithraj.com";
const previewOrigin = "https://news-investwithraj-site-abc123xyz-office-2271s-projects.vercel.app";
const productionOrigin = "https://news-investwithraj-site-def456uvw-office-2271s-projects.vercel.app";
const previewDeploymentId = "dpl_Abc123xyz";
const productionDeploymentId = "dpl_Def456uvw";
const candidateSha = "a".repeat(40);
const productionSha = "b".repeat(40);
const candidateBuildId = "azEh_JQ359v7jpcnQ9mB1";
const productionBuildId = "productionBuild_456";
const sharedEnvironment = {
  NEWSROOM_EXPECTED_PRODUCTION_BUILD_ID: productionBuildId,
  NEWSROOM_EXPECTED_PRODUCTION_SHA: productionSha,
  NEWSROOM_IMMUTABLE_PRODUCTION_URL: productionOrigin,
  NEWSROOM_PRODUCTION_DEPLOYMENT_ID: productionDeploymentId,
  NEWSROOM_PUBLIC_PRODUCTION_URL: publicOrigin,
  NEWSROOM_VERCEL_API_TOKEN: providerSentinel,
};
const beforeEnvironment = {
  ...sharedEnvironment,
  NEWSROOM_AUDIT_OUTPUT: "outputs/newsroom-production-before.json",
  NEWSROOM_INVARIANCE_PHASE: "before",
};
const afterEnvironment = {
  ...sharedEnvironment,
  NEWSROOM_AUDIT_OUTPUT: "outputs/newsroom-hosted-invariance.json",
  NEWSROOM_BUILD_ID: candidateBuildId,
  NEWSROOM_CANDIDATE_SHA: candidateSha,
  NEWSROOM_EXPECTED_RUNTIME_MODE: "default",
  NEWSROOM_INVARIANCE_PHASE: "after",
  NEWSROOM_PREVIEW_BRANCH: "proposed",
  NEWSROOM_PREVIEW_DEPLOYMENT_ID: previewDeploymentId,
  NEWSROOM_PREVIEW_URL: previewOrigin,
  NEWSROOM_PRODUCTION_BASELINE: "outputs/newsroom-production-before.json",
  NEWSROOM_VERCEL_PROTECTION_BYPASS: bypassSentinel,
};

function html(title, canonical) {
  return `<!doctype html><html><head><link rel="canonical" href="${canonical}"></head><body><main><h1>${title}</h1></main></body></html>`;
}
function responseWithUrl(body, init, url) {
  const response = new Response(body, init);
  Object.defineProperty(response, "url", { value: url.href });
  return response;
}
function json(value) {
  return new Response(JSON.stringify(value), { headers: { "content-type": "application/json" }, status: 200 });
}
function deployment({ aliases, id, origin, branch, sha, target }) {
  return {
    alias: aliases ?? (target === "production" ? ["news.investwithraj.com"] : []),
    id,
    meta: { gitCommitRef: branch, gitCommitSha: sha },
    ownerId: "team_fX0MDhZugKxOW3rijXKAgYiA",
    projectId: "prj_kfTRKu4x1NZThilS9JTJTFt8S47h",
    readyState: "READY",
    target: target === "preview" ? null : target,
    url: new URL(origin).hostname,
  };
}

function hostedFetch(
  calls,
  {
    changedPulse = false,
    customPreviewAlias = false,
    missingProductionAlias = false,
    previewCanonicalTakeover = false,
    projectMismatch = false,
  } = {},
) {
  return async (input, options = {}) => {
    const url = input instanceof URL ? input : new URL(input);
    const headers = new Headers(options.headers);
    const bypass = headers.get("x-vercel-protection-bypass");
    const authorization = headers.get("authorization");
    calls.push({ authorization, bypass, method: options.method ?? "GET", origin: url.origin, path: url.pathname });
    assert.equal(options.redirect, "manual");
    if (url.origin === "https://api.vercel.com") {
      assert.equal(bypass, null, "Newsroom bypass must never reach provider API");
      assert.equal(authorization, `Bearer ${providerSentinel}`);
      assert.equal(url.searchParams.get("teamId"), "team_fX0MDhZugKxOW3rijXKAgYiA");
      if (url.pathname.startsWith("/v9/projects/")) return json({
        accountId: projectMismatch ? "team_wrong" : "team_fX0MDhZugKxOW3rijXKAgYiA",
        autoAssignCustomDomains: true,
        framework: "nextjs",
        gitForkProtection: true,
        id: "prj_kfTRKu4x1NZThilS9JTJTFt8S47h",
        link: { org: "investwithraj", productionBranch: "main", repo: "news-investwithraj-site", repoId: 1248443593, type: "github" },
        name: "news-investwithraj-site",
        nodeVersion: "24.x",
        protectionBypass: { current: {} },
        ssoProtection: { deploymentType: "all_except_custom_domains" },
      });
      if (url.pathname.endsWith("/env")) return json({ envs: [{ key: "NEXT_PUBLIC_SITE_NAME", target: ["production", "preview"], type: "plain" }] });
      if (url.pathname.endsWith(productionDeploymentId)) return json(deployment({ aliases: missingProductionAlias ? [] : undefined, id: productionDeploymentId, origin: productionOrigin, branch: "main", sha: productionSha, target: "production" }));
      if (url.pathname.endsWith(previewDeploymentId)) return json(deployment({ aliases: previewCanonicalTakeover ? ["news.investwithraj.com"] : customPreviewAlias ? ["preview.example.com"] : ["news-investwithraj-site-git-proposed-office-2271s-projects.vercel.app"], id: previewDeploymentId, origin: previewOrigin, branch: "proposed", sha: candidateSha, target: "preview" }));
      throw new Error(`Unexpected provider path ${url.pathname}`);
    }
    assert.equal(authorization, null, "Provider credential escaped Vercel API");
    if (url.origin === publicOrigin) {
      assert.equal(bypass, null, "Bypass secret must never reach public Production");
      if (url.pathname === "/") return responseWithUrl(html("Invest With Raj News", `${publicOrigin}/`), { headers: { "content-type": "text/html" }, status: 200 }, url);
      if (url.pathname === "/pulse") return responseWithUrl(html(changedPulse ? "Changed Pulse" : "Market Pulse", `${publicOrigin}/pulse`), { headers: { "content-type": "text/html" }, status: 200 }, url);
      if (url.pathname === "/sitemap.xml") return responseWithUrl("<?xml version=\"1.0\"?><urlset/>", { headers: { "content-type": "application/xml" }, status: 200 }, url);
      if (url.pathname === "/robots.txt") return responseWithUrl("User-agent: *\nAllow: /\n", { headers: { "content-type": "text/plain" }, status: 200 }, url);
    }
    assert.ok([previewOrigin, productionOrigin].includes(url.origin), `Unexpected ${url.href}`);
    if (bypass === null) return responseWithUrl(null, { headers: { location: `https://vercel.com/sso-api?url=${encodeURIComponent(url.href)}`, "x-robots-tag": "noindex" }, status: 302 }, url);
    assert.equal(bypass, bypassSentinel);
    if (url.pathname.includes("/_next/static/")) return responseWithUrl(null, { headers: { "content-type": "application/javascript" }, status: 200 }, url);
    const title = url.origin === productionOrigin ? "Invest With Raj News" : "Newsroom Preview";
    return responseWithUrl(html(title, `${url.origin}/`), { headers: { "content-type": "text/html", "x-robots-tag": "noindex, nofollow" }, status: 200 }, url);
  };
}

const beforeCalls = [];
const baseline = await capturePublicProductionIdentities({ environment: beforeEnvironment, fetchImpl: hostedFetch(beforeCalls) });
assert.equal(baseline.schemaVersion, 2);
assert.equal(baseline.routes.length, 4);
assert.equal(beforeCalls.length, 7);
assert.equal(baseline.provider.production.id, productionDeploymentId);

const afterCalls = [];
const receipt = await runHostedNewsroomInvariance({ baseline, environment: afterEnvironment, fetchImpl: hostedFetch(afterCalls) });
const repeatedReceipt = await runHostedNewsroomInvariance({ baseline, environment: afterEnvironment, fetchImpl: hostedFetch([]) });
assert.deepEqual(receipt, repeatedReceipt, "After receipt must be deterministic");
assert.equal(receipt.invariance.equal, true);
assert.equal(receipt.invariance.routeCount, 4);
assert.equal(receipt.preview.deployment.id, previewDeploymentId);
assert.equal(receipt.production.deployment.id, productionDeploymentId);
assert.equal(afterCalls.length, 14);
assert.equal(afterCalls.filter((call) => call.bypass === bypassSentinel).length, 4);
assert.equal(afterCalls.filter((call) => call.authorization !== null).length, 4);
assert.ok(afterCalls.filter((call) => call.origin !== "https://api.vercel.com").every((call) => call.authorization === null));

const serialized = JSON.stringify(receipt);
assert.equal(serialized.includes(bypassSentinel), false);
assert.equal(serialized.includes(providerSentinel), false);
assert.equal(/generatedAt|timestamp|responseBody/iu.test(serialized), false);

await assert.rejects(() => runHostedNewsroomInvariance({ baseline, environment: afterEnvironment, fetchImpl: hostedFetch([], { changedPulse: true }) }), /Public Production changed after Preview creation/u);
await assert.rejects(() => runHostedNewsroomInvariance({ baseline, environment: { ...afterEnvironment, NEWSROOM_CANDIDATE_SHA: "c".repeat(40) }, fetchImpl: hostedFetch([]) }), /Preview SHA mismatch/u);
await assert.rejects(() => runHostedNewsroomInvariance({ baseline, environment: afterEnvironment, fetchImpl: hostedFetch([], { projectMismatch: true }) }), /Provider team ID mismatch/u);
await assert.rejects(() => runHostedNewsroomInvariance({ baseline, environment: afterEnvironment, fetchImpl: hostedFetch([], { missingProductionAlias: true }) }), /Production aliases must include canonical news\.investwithraj\.com/u);
await assert.rejects(() => runHostedNewsroomInvariance({ baseline, environment: afterEnvironment, fetchImpl: hostedFetch([], { previewCanonicalTakeover: true }) }), /Preview aliases must exclude canonical news\.investwithraj\.com/u);
await assert.rejects(() => runHostedNewsroomInvariance({ baseline, environment: afterEnvironment, fetchImpl: hostedFetch([], { customPreviewAlias: true }) }), /not an exact newsroom project\/team Vercel hostname/u);
assert.throws(() => parseInvarianceConfiguration({ ...afterEnvironment, NEWSROOM_LIFECYCLE_CUTOVER: "1" }), /Lifecycle cutover must be unset/u);
assert.throws(() => parseInvarianceConfiguration({ ...afterEnvironment, NEWSROOM_EVIDENCE_HOLD_PREVIEW: "1" }), /Evidence hold must be unset/u);
await assert.rejects(() => runHostedNewsroomInvariance({ baseline, environment: { ...afterEnvironment, NEWSROOM_VERCEL_PROTECTION_BYPASS: undefined }, fetchImpl: hostedFetch([]) }), /requires newsroom auth/u);

const source = readFileSync(new URL("./test-hosted-newsroom-invariance.mjs", import.meta.url), "utf8");
assert.match(source, /NEWSROOM_PROTECTION_BYPASS_ENV/u);
assert.match(source, /auth\.fetchOptions/u);
assert.doesNotMatch(source, /generatedAt|new Date\(/u);
assert.doesNotMatch(source, /[?&](?:x-vercel-protection-bypass|set-bypass-cookie)=/iu);

console.log("Hosted newsroom invariance contract passed: provider-bound project/env/deployments, four-route Production before/after identity, protected immutable origins and zero credential spray.");
