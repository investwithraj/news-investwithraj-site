#!/usr/bin/env node

import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  NEWSROOM_PROTECTION_BYPASS_ENV,
  createProtectedPreviewAuth,
} from "./lib/protected-preview-auth.mjs";
import { assertPreviewAliasPolicy } from "./test-hosted-newsroom-invariance.mjs";

const API_ORIGIN = "https://api.vercel.com";
const PROJECT_ID = "prj_kfTRKu4x1NZThilS9JTJTFt8S47h";
const TEAM_ID = "team_fX0MDhZugKxOW3rijXKAgYiA";
const PROJECT_NAME = "news-investwithraj-site";
const TEAM_SLUG = "office-2271s-projects";
const PROVIDER_CREDENTIAL_ENV = "NEWSROOM_VERCEL_API_TOKEN";
const IMMUTABLE_HOST =
  /^news-investwithraj-site-[a-z0-9]{8,16}-office-2271s-projects\.vercel\.app$/u;
const TIMEOUT_MS = 45_000;

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

export function parseProviderPreflightConfiguration(environment = process.env) {
  const candidateSha = required(environment, "NEWSROOM_CANDIDATE_SHA");
  const previewBranch = required(environment, "NEWSROOM_PREVIEW_BRANCH");
  assert.match(candidateSha, /^[0-9a-f]{40}$/u, "Invalid candidate SHA");
  assert.match(previewBranch, /^[A-Za-z0-9._/-]{1,200}$/u, "Invalid Preview branch");
  assert.equal(previewBranch.startsWith("/"), false, "Invalid Preview branch");
  assert.equal(previewBranch.includes(".."), false, "Invalid Preview branch");
  required(environment, PROVIDER_CREDENTIAL_ENV);
  return Object.freeze({
    auditOutput: worktreePath(
      required(environment, "NEWSROOM_AUDIT_OUTPUT"),
      "NEWSROOM_AUDIT_OUTPUT",
    ),
    candidateSha,
    previewBranch,
  });
}

function providerRequester(environment, fetchImpl, calls) {
  const credential = required(environment, PROVIDER_CREDENTIAL_ENV);
  return async (pathname) => {
    const url = new URL(pathname, API_ORIGIN);
    assert.equal(url.origin, API_ORIGIN, "Provider request escaped Vercel API");
    url.searchParams.set("teamId", TEAM_ID);
    calls.push(url.pathname);
    const response = await fetchImpl(url, {
      headers: { Authorization: `Bearer ${credential}` },
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    assert.equal(response.headers.get("location"), null, "Provider API redirected");
    assert.equal(response.status, 200, `Provider API ${url.pathname} returned ${response.status}`);
    assert.match(
      response.headers.get("content-type")?.toLowerCase() ?? "",
      /^application\/json(?:;|$)/u,
      `Provider API ${url.pathname} must return JSON`,
    );
    return response.json();
  };
}

async function readAllPages(requestProvider, pathname, collectionName) {
  const results = [];
  let cursor = null;
  for (let page = 0; page < 20; page += 1) {
    const url = new URL(pathname, API_ORIGIN);
    url.searchParams.set("limit", "100");
    if (cursor !== null) url.searchParams.set("until", cursor);
    const response = await requestProvider(`${url.pathname}${url.search}`);
    assert.ok(Array.isArray(response[collectionName]), `${collectionName} response malformed`);
    results.push(...response[collectionName]);
    cursor = response.pagination?.next == null ? null : String(response.pagination.next);
    if (cursor === null) return results;
  }
  throw new Error(`${collectionName} pagination exceeded deterministic page bound`);
}

function sourceIdentity(deployment) {
  const meta = deployment.meta ?? {};
  return {
    branch: meta.gitCommitRef ?? meta.githubCommitRef ?? deployment.gitSource?.ref ?? null,
    sha: meta.gitCommitSha ?? meta.githubCommitSha ?? deployment.gitSource?.sha ?? null,
  };
}

function deploymentId(deployment) {
  const id = deployment.id ?? deployment.uid;
  assert.match(id ?? "", /^dpl_[A-Za-z0-9]+$/u, "Invalid provider deployment ID");
  return id;
}

function deploymentReadyState(deployment) {
  return deployment.readyState ?? deployment.state ?? null;
}

function immutableOrigin(deployment) {
  const value = deployment.url?.startsWith("http")
    ? deployment.url
    : `https://${deployment.url}`;
  const url = new URL(value);
  assert.equal(url.pathname, "/", "Deployment URL must be an origin");
  assert.equal(url.search, "", "Deployment URL must not contain a query");
  assert.equal(url.hash, "", "Deployment URL must not contain a fragment");
  assert.match(url.hostname, IMMUTABLE_HOST, "Deployment URL is not exact newsroom immutable host");
  assert.ok(url.hostname.endsWith(`-${TEAM_SLUG}.vercel.app`));
  return url.origin;
}

function sanitizeDeployment(deployment) {
  return {
    aliases: [...(deployment.alias ?? [])].toSorted(),
    id: deploymentId(deployment),
    ownerId: deployment.ownerId,
    projectId: deployment.projectId,
    readyState: deploymentReadyState(deployment),
    source: sourceIdentity(deployment),
    target: deployment.target ?? "preview",
    url: immutableOrigin(deployment),
  };
}

function validateDeployment(deployment, expected, role) {
  assert.equal(deployment.projectId, PROJECT_ID, `${role} project mismatch`);
  assert.equal(deployment.ownerId, TEAM_ID, `${role} team mismatch`);
  assert.equal(deployment.readyState, "READY", `${role} is not READY`);
  assert.equal(deployment.target, expected.target, `${role} target mismatch`);
  assert.equal(deployment.source.branch, expected.branch, `${role} branch mismatch`);
  if (expected.sha !== undefined) {
    assert.equal(deployment.source.sha, expected.sha, `${role} SHA mismatch`);
  } else {
    assert.match(deployment.source.sha ?? "", /^[0-9a-f]{40}$/u, `${role} SHA missing`);
  }
  if (expected.target === "production") {
    assert.ok(
      deployment.aliases.includes("news.investwithraj.com"),
      "Production aliases must include canonical news.investwithraj.com",
    );
  } else {
    assertPreviewAliasPolicy(deployment.aliases);
  }
}

function sanitizeProject(project) {
  const snapshot = {
    autoAssignCustomDomains: project.autoAssignCustomDomains,
    framework: project.framework,
    git: {
      org: project.link?.org,
      productionBranch: project.link?.productionBranch,
      repo: project.link?.repo,
      repoId: String(project.link?.repoId ?? ""),
      type: project.link?.type,
    },
    gitForkProtection: project.gitForkProtection,
    id: project.id,
    name: project.name,
    nodeVersion: project.nodeVersion,
    ownerId: project.accountId,
    productionDeploymentId: project.targets?.production?.id,
    protectionBypassCount: Object.keys(project.protectionBypass ?? {}).length,
    ssoProtection: project.ssoProtection?.deploymentType ?? null,
  };
  assert.equal(snapshot.id, PROJECT_ID, "Provider project ID mismatch");
  assert.equal(snapshot.ownerId, TEAM_ID, "Provider team ID mismatch");
  assert.equal(snapshot.name, PROJECT_NAME, "Provider project name mismatch");
  assert.equal(snapshot.framework, "nextjs", "Provider framework mismatch");
  assert.equal(snapshot.git.type, "github", "Provider Git type mismatch");
  assert.equal(snapshot.git.org, "investwithraj", "Provider Git owner mismatch");
  assert.equal(snapshot.git.repo, "news-investwithraj-site", "Provider Git repo mismatch");
  assert.equal(snapshot.git.productionBranch, "main", "Provider Production branch mismatch");
  assert.match(
    snapshot.productionDeploymentId ?? "",
    /^dpl_[A-Za-z0-9]+$/u,
    "Provider active Production deployment missing",
  );
  return snapshot;
}

function sanitizeEnvironment(entries) {
  const result = entries
    .map((entry) => ({
      key: entry.key,
      targets: [...(entry.target ?? [])].toSorted(),
      type: entry.type,
    }))
    .toSorted((left, right) =>
      `${left.key}\0${left.type}\0${left.targets.join(",")}`.localeCompare(
        `${right.key}\0${right.type}\0${right.targets.join(",")}`,
      ),
    );
  for (const forbiddenKey of [
    "NEWSROOM_LIFECYCLE_CUTOVER",
    "NEWSROOM_EVIDENCE_HOLD_PREVIEW",
    "NEWSROOM_VERCEL_PROTECTION_BYPASS",
    PROVIDER_CREDENTIAL_ENV,
  ]) {
    assert.equal(
      result.some((entry) => entry.key === forbiddenKey),
      false,
      `${forbiddenKey} must remain absent from Vercel project env`,
    );
  }
  return result;
}

function robotsTokens(response) {
  return (response.headers.get("x-robots-tag") ?? "")
    .toLowerCase()
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean);
}

function sameOrigin(response, requested, label) {
  assert.equal(response.headers.get("location"), null, `${label} redirected`);
  if (!response.url) return;
  const delivered = new URL(response.url);
  assert.equal(delivered.origin, requested.origin, `${label} leaked host`);
  assert.equal(delivered.pathname, requested.pathname, `${label} changed path`);
}

function collectDeploymentFilePaths(value, prefix = "") {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) {
    return value.flatMap((entry) => collectDeploymentFilePaths(entry, prefix));
  }
  if (value === null || typeof value !== "object") return [];
  const name = typeof value.name === "string" ? value.name : "";
  const explicitPath = typeof value.path === "string" ? value.path : "";
  const current = explicitPath || (name ? `${prefix}/${name}` : prefix);
  const own = value.type === "file" || (!value.children && !value.files)
    ? [current]
    : [];
  return [
    ...own,
    ...collectDeploymentFilePaths(value.children ?? [], current),
    ...collectDeploymentFilePaths(value.files ?? [], current),
  ];
}

async function discoverBuild(requestProvider, fetchImpl, auth, deployment, label) {
  const filesResponse = await requestProvider(`/v6/deployments/${deployment.id}/files`);
  const filePaths = collectDeploymentFilePaths(filesResponse.files ?? filesResponse)
    .map((filePath) => filePath.replaceAll("\\", "/").replace(/^\/+|\/+$/gu, ""));
  const candidates = new Set();
  for (const filePath of filePaths) {
    const match = filePath.match(
      /(?:^|\/)(?:\.next|_next)\/static\/([A-Za-z0-9_-]{8,128})\/_buildManifest\.js$/u,
    );
    if (match) candidates.add(match[1]);
  }
  assert.equal(
    candidates.size,
    1,
    `${label} deployed files must expose exactly one Next build ID`,
  );
  const buildId = [...candidates][0];
  const origin = deployment.url;
  const rootUrl = new URL("/", origin);
  const anonymous = await fetchImpl(rootUrl, {
    redirect: "manual",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  assert.ok([302, 401].includes(anonymous.status), `${label} is anonymously accessible`);
  assert.ok(robotsTokens(anonymous).includes("noindex"), `${label} anonymous response lacks noindex`);

  const buildPath = `/_next/static/${buildId}/_buildManifest.js`;
  const buildUrl = new URL(buildPath, origin);
  const buildResponse = await fetchImpl(
    buildUrl,
    auth.fetchOptions({
      method: "HEAD",
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    }),
  );
  sameOrigin(buildResponse, buildUrl, `${label} build`);
  assert.equal(buildResponse.status, 200, `${label} build must return 200`);
  assert.match(
    buildResponse.headers.get("content-type")?.toLowerCase() ?? "",
    /^(?:application|text)\/(?:javascript|x-javascript)(?:;|$)/u,
    `${label} build must be JavaScript`,
  );
  return { buildAssetPath: buildPath, buildId };
}

export async function runHostedNewsroomProviderPreflight({
  environment = process.env,
  fetchImpl = globalThis.fetch,
} = {}) {
  const config = parseProviderPreflightConfiguration(environment);
  const providerCalls = [];
  const requestProvider = providerRequester(environment, fetchImpl, providerCalls);
  const projectRaw = await requestProvider(`/v9/projects/${PROJECT_ID}`);
  const project = sanitizeProject(projectRaw);
  const environmentEntries = await readAllPages(
    requestProvider,
    `/v10/projects/${PROJECT_ID}/env`,
    "envs",
  );
  const environmentKeys = sanitizeEnvironment(environmentEntries);
  const productionRaw = await requestProvider(
    `/v13/deployments/${project.productionDeploymentId}`,
  );
  const production = sanitizeDeployment(productionRaw);
  validateDeployment(
    production,
    { branch: "main", target: "production" },
    "Production",
  );

  const previewList = await readAllPages(
    requestProvider,
    "/v6/deployments?projectId=" + PROJECT_ID + "&target=preview&state=READY",
    "deployments",
  );
  const candidates = previewList.filter((deployment) => {
    const source = sourceIdentity(deployment);
    return (
      source.branch === config.previewBranch &&
      source.sha === config.candidateSha &&
      (deployment.target ?? "preview") === "preview" &&
      deploymentReadyState(deployment) === "READY"
    );
  });
  assert.equal(
    candidates.length,
    1,
    `Expected exactly one READY Preview for candidate SHA/branch; found ${candidates.length}`,
  );
  const previewRaw = await requestProvider(
    `/v13/deployments/${deploymentId(candidates[0])}`,
  );
  const preview = sanitizeDeployment(previewRaw);
  validateDeployment(
    preview,
    { branch: config.previewBranch, sha: config.candidateSha, target: "preview" },
    "Preview",
  );
  assert.notEqual(preview.url, production.url, "Preview and Production immutable URLs must differ");

  const auth = createProtectedPreviewAuth(
    NEWSROOM_PROTECTION_BYPASS_ENV,
    environment,
  );
  assert.equal(auth.authConfigured, true, "Provider preflight requires newsroom Preview auth");
  const productionBuild = await discoverBuild(
    requestProvider,
    fetchImpl,
    auth,
    production,
    "Immutable Production",
  );
  const previewBuild = await discoverBuild(
    requestProvider,
    fetchImpl,
    auth,
    preview,
    "Preview",
  );

  return Object.freeze({
    schemaVersion: 1,
    authConfigured: auth.authConfigured,
    project,
    environmentKeys,
    production: { ...production, ...productionBuild },
    preview: { ...preview, ...previewBuild },
    providerRequests: providerCalls.length,
    result: "pass",
  });
}

async function main() {
  const config = parseProviderPreflightConfiguration(process.env);
  const receipt = await runHostedNewsroomProviderPreflight();
  await mkdir(path.dirname(config.auditOutput), { recursive: true });
  await writeFile(config.auditOutput, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
  console.log(
    `Newsroom provider preflight passed: Production ${receipt.production.id}/${receipt.production.buildId}; Preview ${receipt.preview.id}/${receipt.preview.buildId}; auth ${receipt.authConfigured}.`,
  );
}

const isMain =
  process.argv[1] !== undefined &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (isMain) await main();
