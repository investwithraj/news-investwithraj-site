#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  NEWSROOM_PROTECTION_BYPASS_ENV,
  createProtectedPreviewAuth,
} from "./lib/protected-preview-auth.mjs";

const EXPECTED_PATHS = 16;
const EXPECTED_GETS = 3;
const EXPECTED_WITHHELD = 31;
const EXPECTED_UNKNOWN_ON_DISK = 16;
const SYNTHETIC_UNKNOWN_PATHS = Object.freeze([
  "/audio/not-recorded.mp3",
  "/cinema/not-recorded.mp4",
  "/media/real-uhd/not-recorded.webp",
  "/media/verified/areas/not-recorded.webp",
]);
const IMMUTABLE_NEWSROOM_HOST =
  /^news-investwithraj-site-[a-z0-9]{8,16}-office-2271s-projects\.vercel\.app$/u;
const TIMEOUT_MS = 45_000;
const manifestUrl = new URL("../config/media-contract.json", import.meta.url);

function required(environment, name) {
  const value = environment[name];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TypeError(`${name} must be a non-empty string`);
  }
  assert.equal(value, value.trim(), `${name} has outer whitespace`);
  assert.equal(/[\u0000-\u001f\u007f]/u.test(value), false, `${name} has controls`);
  return value;
}

function worktreePath(value, name) {
  const root = path.resolve(process.cwd());
  const resolved = path.resolve(root, value);
  const relation = path.relative(root, resolved);
  assert.ok(
    relation !== "" && !relation.startsWith("..") && !path.isAbsolute(relation),
    `${name} must resolve inside the newsroom worktree`,
  );
  return resolved;
}

function auditOrigin(value) {
  const url = new URL(value);
  assert.equal(url.username, "", "Audit URL must not contain credentials");
  assert.equal(url.password, "", "Audit URL must not contain credentials");
  assert.equal(url.pathname, "/", "Audit URL must be an origin");
  assert.equal(url.search, "", "Audit URL must not contain a query");
  assert.equal(url.hash, "", "Audit URL must not contain a fragment");
  const local = ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname);
  const hosted = IMMUTABLE_NEWSROOM_HOST.test(url.hostname);
  assert.ok(
    local || hosted,
    "Audit URL must be localhost or the exact immutable newsroom deployment hostname",
  );
  if (hosted) assert.equal(url.protocol, "https:", "Hosted audit must use HTTPS");
  return { hosted, origin: url.origin };
}

export function parseMediaAuditConfiguration(environment = process.env) {
  assert.equal(
    environment.NEWSROOM_EXPECT_PROTECTED_PREVIEW,
    "1",
    "NEWSROOM_EXPECT_PROTECTED_PREVIEW must equal 1",
  );
  const candidateSha = required(environment, "NEWSROOM_CANDIDATE_SHA");
  const buildId = required(environment, "NEWSROOM_BUILD_ID");
  assert.match(candidateSha, /^[0-9a-f]{40}$/u, "Invalid candidate SHA");
  assert.match(buildId, /^[A-Za-z0-9_-]{8,128}$/u, "Invalid build ID");
  const url = auditOrigin(required(environment, "NEWSROOM_AUDIT_URL"));
  return Object.freeze({
    auditOutput: worktreePath(
      required(environment, "NEWSROOM_AUDIT_OUTPUT"),
      "NEWSROOM_AUDIT_OUTPUT",
    ),
    auditUrl: url.origin,
    buildId,
    candidateSha,
    hosted: url.hosted,
  });
}

export function readMediaAuthority() {
  return JSON.parse(readFileSync(manifestUrl, "utf8"));
}

function validateExactPath(mediaPath, origin) {
  assert.equal(typeof mediaPath, "string", "Media path must be a string");
  assert.ok(
    mediaPath.startsWith("/") && !mediaPath.startsWith("//"),
    `${mediaPath} is not single-root relative`,
  );
  for (const [pattern, message] of [
    [/\/\//u, "empty segment"],
    [/\\/u, "backslash"],
    [/[?#]/u, "query or fragment"],
    [/%/u, "percent encoding"],
    [/[\u0000-\u001f\u007f]/u, "control character"],
  ]) {
    assert.equal(pattern.test(mediaPath), false, `${mediaPath} contains ${message}`);
  }
  assert.equal(
    mediaPath.split("/").some((segment) => segment === "." || segment === ".."),
    false,
    `${mediaPath} contains a dot segment`,
  );
  const resolved = new URL(mediaPath, origin);
  assert.equal(resolved.origin, origin, `${mediaPath} resolves off origin`);
  assert.equal(resolved.pathname, mediaPath, `${mediaPath} normalizes to another path`);
}

export function validateMediaAuthority(authority, origin = "https://audit.invalid") {
  assert.equal(authority.schemaVersion, 1);
  assert.equal(authority.site, "news.investwithraj.com");
  assert.equal(authority.policy.unknownDefault, "withheld");
  assert.equal(authority.assets.length, EXPECTED_PATHS);
  const withheld = authority.dormantMedia.flatMap((entry) => [
    ...(Object.hasOwn(entry, "path") ? [entry.path] : []),
    ...(Object.hasOwn(entry, "paths") ? entry.paths : []),
  ]);
  assert.equal(withheld.length, EXPECTED_WITHHELD);
  assert.equal(new Set(withheld).size, EXPECTED_WITHHELD);
  assert.equal(authority.unknownGovernedMedia.length, EXPECTED_UNKNOWN_ON_DISK);
  assert.equal(
    new Set(authority.unknownGovernedMedia).size,
    EXPECTED_UNKNOWN_ON_DISK,
  );
  const paths = authority.assets.map((asset) => asset.path);
  assert.equal(new Set(paths).size, EXPECTED_PATHS, "Approved paths must be unique");
  for (const asset of authority.assets) {
    validateExactPath(asset.path, origin);
    assert.equal(asset.mediaType, "image", `${asset.path} must remain an image`);
    assert.ok(
      ["approved", "approved-context"].includes(asset.approval),
      `${asset.path} is not public-approved`,
    );
    assert.equal(asset.path.endsWith(".webp"), true, `${asset.path} must be WebP`);
  }
  for (const deniedPath of [...withheld, ...authority.unknownGovernedMedia]) {
    validateExactPath(deniedPath, origin);
    assert.equal(paths.includes(deniedPath), false, `${deniedPath} is also approved`);
  }
  return authority;
}

export function deniedMediaChecks(authority) {
  const withheld = authority.dormantMedia.flatMap((entry) => [
    ...(Object.hasOwn(entry, "path") ? [entry.path] : []),
    ...(Object.hasOwn(entry, "paths") ? entry.paths : []),
  ]);
  const checks = [
    ...withheld.map((mediaPath) => ({ path: mediaPath, state: "withheld" })),
    ...authority.unknownGovernedMedia.map((mediaPath) => ({
      path: mediaPath,
      state: "unknown-on-disk",
    })),
    ...SYNTHETIC_UNKNOWN_PATHS.map((mediaPath) => ({
      path: mediaPath,
      state: "unknown-synthetic",
    })),
  ];
  assert.equal(checks.length, EXPECTED_WITHHELD + EXPECTED_UNKNOWN_ON_DISK + 4);
  assert.equal(new Set(checks.map((check) => check.path)).size, checks.length);
  return checks;
}

export function representativeMediaChecks(authority) {
  const groups = ["/media/verified/areas/", "/media/verified/developers/", "/media/real-uhd/"];
  const checks = groups.map((prefix) => {
    const asset = authority.assets
      .filter((candidate) => candidate.path.startsWith(prefix))
      .toSorted((left, right) => left.path.localeCompare(right.path))[0];
    assert.ok(asset, `No approved media for ${prefix}`);
    return { path: asset.path, role: prefix };
  });
  assert.equal(checks.length, EXPECTED_GETS);
  return checks;
}

function protectedMediaRobots(response, label) {
  const tokens = new Set(
    (response.headers.get("x-robots-tag") ?? "")
      .toLowerCase()
      .split(",")
      .map((token) => token.trim())
      .filter(Boolean),
  );
  assert.ok(tokens.has("noindex"), `${label} must carry X-Robots-Tag noindex`);
  assert.ok(tokens.has("noarchive"), `${label} must carry X-Robots-Tag noarchive`);
  assert.equal(tokens.has("index"), false, `${label} contradicts noindex with index`);
  assert.equal(tokens.has("all"), false, `${label} contradicts noindex with all`);
}

function sameOrigin(response, requested, label) {
  assert.equal(response.headers.get("location"), null, `${label} redirected`);
  if (!response.url) return;
  const delivered = new URL(response.url);
  assert.equal(delivered.origin, requested.origin, `${label} leaked host`);
  assert.equal(delivered.pathname, requested.pathname, `${label} changed path`);
  assert.equal(delivered.search, "", `${label} added a query`);
}

async function request(fetchImpl, auth, url, options) {
  return fetchImpl(
    url,
    auth.fetchOptions({
      ...options,
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    }),
  );
}

function assertImage(response, label) {
  assert.match(
    response.headers.get("content-type")?.toLowerCase() ?? "",
    /^image\/webp(?:;|$)/u,
    `${label} is not WebP`,
  );
}

async function nonemptyBody(response, label) {
  assert.ok(response.body, `${label} has no body`);
  const reader = response.body.getReader();
  const first = await reader.read();
  await reader.cancel();
  assert.equal(first.done, false, `${label} body is empty`);
  assert.ok(first.value.byteLength > 0, `${label} body is empty`);
}

export async function runHostedNewsroomMediaDelivery({
  authority = readMediaAuthority(),
  environment = process.env,
  fetchImpl = globalThis.fetch,
} = {}) {
  const config = parseMediaAuditConfiguration(environment);
  const mediaAuthority = validateMediaAuthority(authority, config.auditUrl);
  const auth = createProtectedPreviewAuth(
    NEWSROOM_PROTECTION_BYPASS_ENV,
    environment,
  );
  if (config.hosted) {
    assert.equal(auth.authConfigured, true, "Hosted Preview requires newsroom auth");
  }

  const buildPath = `/_next/static/${config.buildId}/_buildManifest.js`;
  const buildUrl = new URL(buildPath, config.auditUrl);
  const buildResponse = await request(fetchImpl, auth, buildUrl, { method: "HEAD" });
  sameOrigin(buildResponse, buildUrl, "Build identity");
  assert.equal(buildResponse.status, 200, "Build identity must return 200");
  assert.match(
    buildResponse.headers.get("content-type")?.toLowerCase() ?? "",
    /^(?:application|text)\/(?:javascript|x-javascript)(?:;|$)/u,
    "Build identity must be JavaScript",
  );

  const headResults = [];
  for (const asset of mediaAuthority.assets) {
    const url = new URL(asset.path, config.auditUrl);
    const response = await request(fetchImpl, auth, url, { method: "HEAD" });
    sameOrigin(response, url, `HEAD ${asset.path}`);
    assert.equal(response.status, 200, `HEAD ${asset.path} must return 200`);
    assertImage(response, `HEAD ${asset.path}`);
    protectedMediaRobots(response, `HEAD ${asset.path}`);
    headResults.push({ path: asset.path, status: response.status });
  }

  const getResults = [];
  for (const check of representativeMediaChecks(mediaAuthority)) {
    const url = new URL(check.path, config.auditUrl);
    const response = await request(fetchImpl, auth, url, {
      headers: { Range: "bytes=0-1023" },
      method: "GET",
    });
    sameOrigin(response, url, `GET ${check.path}`);
    assert.ok([200, 206].includes(response.status), `GET ${check.path} failed`);
    assertImage(response, `GET ${check.path}`);
    protectedMediaRobots(response, `GET ${check.path}`);
    await nonemptyBody(response, `GET ${check.path}`);
    getResults.push({ path: check.path, role: check.role, status: response.status });
  }

  const deniedResults = [];
  for (const check of deniedMediaChecks(mediaAuthority)) {
    const url = new URL(check.path, config.auditUrl);
    const response = await request(fetchImpl, auth, url, { method: "HEAD" });
    sameOrigin(response, url, `DENY ${check.path}`);
    assert.equal(response.status, 404, `${check.path} must fail closed`);
    assert.match(
      response.headers.get("content-type")?.toLowerCase() ?? "",
      /^text\/plain(?:;|$)/u,
      `${check.path} denial content type drifted`,
    );
    assert.match(response.headers.get("cache-control") ?? "", /no-store/iu);
    protectedMediaRobots(response, `DENY ${check.path}`);
    deniedResults.push({ path: check.path, state: check.state, status: response.status });
    if (response.body) await response.body.cancel();
  }

  return Object.freeze({
    schemaVersion: 1,
    auditUrl: config.auditUrl,
    authConfigured: auth.authConfigured,
    candidate: {
      buildAssetPath: buildPath,
      buildAssetStatus: buildResponse.status,
      buildId: config.buildId,
      sha: config.candidateSha,
    },
    expectation: "protected-preview",
    authority: {
      exactPaths: mediaAuthority.assets.length,
      schemaVersion: mediaAuthority.schemaVersion,
      source: "config/media-contract.json#assets",
      unknownOnDisk: mediaAuthority.unknownGovernedMedia.length,
      withheld: EXPECTED_WITHHELD,
    },
    requests: {
      head: { expected: EXPECTED_PATHS, passed: headResults.length, results: headResults },
      get: { expected: EXPECTED_GETS, passed: getResults.length, results: getResults },
      denied: {
        expected: EXPECTED_WITHHELD + EXPECTED_UNKNOWN_ON_DISK + 4,
        passed: deniedResults.length,
        results: deniedResults,
      },
      total: 1 + headResults.length + getResults.length + deniedResults.length,
    },
    result: "pass",
  });
}

async function main() {
  const config = parseMediaAuditConfiguration(process.env);
  const receipt = await runHostedNewsroomMediaDelivery();
  await mkdir(path.dirname(config.auditOutput), { recursive: true });
  await writeFile(config.auditOutput, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
  console.log(
    `Newsroom hosted media delivery passed: ${receipt.requests.head.passed}/16 approved HEAD, ${receipt.requests.get.passed}/3 GET, ${receipt.requests.denied.passed}/51 denied HEAD, build ${receipt.candidate.buildId}, auth ${receipt.authConfigured}.`,
  );
}

const isMain =
  process.argv[1] !== undefined &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (isMain) await main();
