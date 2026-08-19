#!/usr/bin/env node

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  NEWSROOM_PROTECTION_BYPASS_ENV,
  createProtectedPreviewAuth,
} from "./lib/protected-preview-auth.mjs";

const TIMEOUT_MS = 45_000;
const VERCEL_API_ORIGIN = "https://api.vercel.com";
const VERCEL_PROJECT_ID = "prj_kfTRKu4x1NZThilS9JTJTFt8S47h";
const VERCEL_TEAM_ID = "team_fX0MDhZugKxOW3rijXKAgYiA";
const VERCEL_PROJECT_NAME = "news-investwithraj-site";
const VERCEL_TEAM_SLUG = "office-2271s-projects";
const VERCEL_GIT_ORG = "investwithraj";
const VERCEL_GIT_REPO = "news-investwithraj-site";
const VERCEL_PRODUCTION_BRANCH = "main";
const VERCEL_PROVIDER_CREDENTIAL_ENV = "NEWSROOM_VERCEL_API_TOKEN";
const IMMUTABLE_NEWSROOM_HOST =
  /^news-investwithraj-site-[a-z0-9]{8,16}-office-2271s-projects\.vercel\.app$/u;
const PUBLIC_ROUTES = Object.freeze([
  { kind: "html", path: "/" },
  { kind: "html", path: "/pulse" },
  { kind: "xml", path: "/sitemap.xml" },
  { kind: "text", path: "/robots.txt" },
]);

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

function exactOrigin(value, role) {
  const url = new URL(value);
  assert.equal(url.username, "", `${role} URL contains credentials`);
  assert.equal(url.password, "", `${role} URL contains credentials`);
  assert.equal(url.pathname, "/", `${role} URL must be an origin`);
  assert.equal(url.search, "", `${role} URL contains a query`);
  assert.equal(url.hash, "", `${role} URL contains a fragment`);
  assert.equal(url.protocol, "https:", `${role} URL must use HTTPS`);
  return url.origin;
}

export function parseInvarianceConfiguration(environment = process.env) {
  const phase = required(environment, "NEWSROOM_INVARIANCE_PHASE");
  assert.ok(["before", "after"].includes(phase), "Invalid invariance phase");
  const publicProductionUrl = exactOrigin(
    required(environment, "NEWSROOM_PUBLIC_PRODUCTION_URL"),
    "Public Production",
  );
  assert.equal(
    new URL(publicProductionUrl).hostname,
    "news.investwithraj.com",
    "Public Production must be news.investwithraj.com",
  );
  const shared = {
    auditOutput: worktreePath(
      required(environment, "NEWSROOM_AUDIT_OUTPUT"),
      "NEWSROOM_AUDIT_OUTPUT",
    ),
    phase,
    publicProductionUrl,
    productionBuildId: required(environment, "NEWSROOM_EXPECTED_PRODUCTION_BUILD_ID"),
    productionDeploymentId: required(environment, "NEWSROOM_PRODUCTION_DEPLOYMENT_ID"),
    productionSha: required(environment, "NEWSROOM_EXPECTED_PRODUCTION_SHA"),
    productionUrl: exactOrigin(
      required(environment, "NEWSROOM_IMMUTABLE_PRODUCTION_URL"),
      "Immutable Production",
    ),
  };
  assert.match(shared.productionDeploymentId, /^dpl_[A-Za-z0-9]+$/u);
  assert.match(shared.productionSha, /^[0-9a-f]{40}$/u, "Invalid Production SHA");
  assert.match(
    shared.productionBuildId,
    /^[A-Za-z0-9_-]{8,128}$/u,
    "Invalid Production build ID",
  );
  assert.match(
    new URL(shared.productionUrl).hostname,
    IMMUTABLE_NEWSROOM_HOST,
    "Immutable Production must be the exact immutable newsroom deployment URL",
  );
  required(environment, VERCEL_PROVIDER_CREDENTIAL_ENV);
  if (phase === "before") return Object.freeze(shared);

  assert.equal(
    required(environment, "NEWSROOM_EXPECTED_RUNTIME_MODE"),
    "default",
    "Hosted Preview must use default mode",
  );
  assert.equal(
    environment.NEWSROOM_LIFECYCLE_CUTOVER,
    undefined,
    "Lifecycle cutover must be unset",
  );
  assert.equal(
    environment.NEWSROOM_EVIDENCE_HOLD_PREVIEW,
    undefined,
    "Evidence hold must be unset",
  );

  const previewUrl = exactOrigin(required(environment, "NEWSROOM_PREVIEW_URL"), "Preview");
  for (const [role, url] of [
    ["Preview", previewUrl],
    ["Immutable Production", shared.productionUrl],
  ]) {
    assert.match(
      new URL(url).hostname,
      IMMUTABLE_NEWSROOM_HOST,
      `${role} must be the exact immutable newsroom deployment URL`,
    );
  }
  assert.notEqual(previewUrl, shared.productionUrl, "Preview and Production URLs must differ");

  const candidateSha = required(environment, "NEWSROOM_CANDIDATE_SHA");
  const candidateBuildId = required(environment, "NEWSROOM_BUILD_ID");
  const previewBranch = required(environment, "NEWSROOM_PREVIEW_BRANCH");
  const previewDeploymentId = required(environment, "NEWSROOM_PREVIEW_DEPLOYMENT_ID");
  assert.match(candidateSha, /^[0-9a-f]{40}$/u, "Invalid candidate SHA");
  assert.match(candidateBuildId, /^[A-Za-z0-9_-]{8,128}$/u, "Invalid candidate build ID");
  assert.match(previewDeploymentId, /^dpl_[A-Za-z0-9]+$/u);

  return Object.freeze({
    ...shared,
    baselinePath: worktreePath(
      required(environment, "NEWSROOM_PRODUCTION_BASELINE"),
      "NEWSROOM_PRODUCTION_BASELINE",
    ),
    candidateBuildId,
    candidateSha,
    previewBranch,
    previewUrl,
    previewDeploymentId,
  });
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function tagAttribute(tag, name) {
  return tag.match(new RegExp(`(?:^|\\s)${name}=["']([^"']*)["']`, "iu"))?.[1] ?? null;
}

function htmlIdentity(body, origin, pathname) {
  const h1 = body.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/iu)?.[1]
    ?.replace(/<[^>]+>/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
  assert.ok(h1, `${pathname} has no H1`);
  const canonicalTag = [...body.matchAll(/<link\b[^>]*>/giu)].find(
    (match) => tagAttribute(match[0], "rel")?.toLowerCase() === "canonical",
  )?.[0];
  const canonical = canonicalTag ? tagAttribute(canonicalTag, "href") : null;
  assert.ok(canonical, `${pathname} has no canonical`);
  const canonicalUrl = new URL(canonical, origin);
  assert.equal(canonicalUrl.origin, origin, `${pathname} canonical origin changed`);
  assert.equal(canonicalUrl.pathname, pathname, `${pathname} is not self-canonical`);
  return { bodySha256: sha256(body), canonical: canonicalUrl.href, h1 };
}

function robotsHeader(response) {
  return (response.headers.get("x-robots-tag") ?? "")
    .toLowerCase()
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean)
    .toSorted();
}

function sameOrigin(response, requested, label) {
  assert.equal(response.headers.get("location"), null, `${label} redirected`);
  if (!response.url) return;
  const delivered = new URL(response.url);
  assert.equal(delivered.origin, requested.origin, `${label} leaked host`);
  assert.equal(delivered.pathname, requested.pathname, `${label} changed path`);
}

async function rawRequest(fetchImpl, url, options = {}) {
  return fetchImpl(url, {
    ...options,
    redirect: "manual",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
}

function providerRequester(environment, fetchImpl) {
  const credential = required(environment, VERCEL_PROVIDER_CREDENTIAL_ENV);
  return async (pathname) => {
    const url = new URL(pathname, VERCEL_API_ORIGIN);
    assert.equal(url.origin, VERCEL_API_ORIGIN, "Provider request escaped Vercel API");
    url.searchParams.set("teamId", VERCEL_TEAM_ID);
    const response = await fetchImpl(url, {
      headers: { Authorization: `Bearer ${credential}` },
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    assert.equal(response.headers.get("location"), null, "Provider API redirected");
    assert.equal(response.status, 200, `Provider API ${pathname} returned ${response.status}`);
    assert.match(
      response.headers.get("content-type")?.toLowerCase() ?? "",
      /^application\/json(?:;|$)/u,
      `Provider API ${pathname} must return JSON`,
    );
    return response.json();
  };
}

function deploymentSource(deployment) {
  const meta = deployment.meta ?? {};
  return {
    branch:
      meta.gitCommitRef ?? meta.githubCommitRef ?? deployment.gitSource?.ref ?? null,
    sha:
      meta.gitCommitSha ?? meta.githubCommitSha ?? deployment.gitSource?.sha ?? null,
  };
}

function sanitizeDeployment(deployment) {
  const url = exactOrigin(
    deployment.url?.startsWith("http") ? deployment.url : `https://${deployment.url}`,
    "Provider deployment",
  );
  assert.match(new URL(url).hostname, IMMUTABLE_NEWSROOM_HOST);
  assert.ok(
    new URL(url).hostname.endsWith(`-${VERCEL_TEAM_SLUG}.vercel.app`),
    "Provider deployment team slug mismatch",
  );
  return {
    aliases: [...(deployment.alias ?? [])].toSorted(),
    id: deployment.id,
    ownerId: deployment.ownerId,
    projectId: deployment.projectId,
    readyState: deployment.readyState,
    source: deploymentSource(deployment),
    target: deployment.target ?? "preview",
    url,
  };
}

function sanitizeProject(project) {
  return {
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
    protectionBypassCount: Object.keys(project.protectionBypass ?? {}).length,
    ssoProtection: project.ssoProtection?.deploymentType ?? null,
  };
}

function sanitizeEnvironment(environmentResponse) {
  return (environmentResponse.envs ?? [])
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
}

async function readAllProviderEnvironment(requestProvider) {
  const envs = [];
  let cursor = null;
  for (let page = 0; page < 20; page += 1) {
    const query = new URLSearchParams({ limit: "100" });
    if (cursor !== null) query.set("until", cursor);
    const response = await requestProvider(
      `/v10/projects/${VERCEL_PROJECT_ID}/env?${query.toString()}`,
    );
    assert.ok(Array.isArray(response.envs), "Provider env response is malformed");
    envs.push(...response.envs);
    cursor = response.pagination?.next == null ? null : String(response.pagination.next);
    if (cursor === null) return { envs };
  }
  throw new Error("Provider env pagination exceeded the deterministic page bound");
}

function validateProject(project) {
  assert.equal(project.id, VERCEL_PROJECT_ID, "Provider project ID mismatch");
  assert.equal(project.ownerId, VERCEL_TEAM_ID, "Provider team ID mismatch");
  assert.equal(project.name, VERCEL_PROJECT_NAME, "Provider project name mismatch");
  assert.equal(project.framework, "nextjs", "Provider framework mismatch");
  assert.equal(project.git.type, "github", "Provider Git type mismatch");
  assert.equal(project.git.org, VERCEL_GIT_ORG, "Provider Git owner mismatch");
  assert.equal(project.git.repo, VERCEL_GIT_REPO, "Provider Git repository mismatch");
  assert.equal(
    project.git.productionBranch,
    VERCEL_PRODUCTION_BRANCH,
    "Provider Production branch mismatch",
  );
}

function validateDeployment(deployment, expected, role) {
  assert.equal(deployment.id, expected.id, `${role} deployment ID mismatch`);
  assert.equal(deployment.projectId, VERCEL_PROJECT_ID, `${role} project mismatch`);
  assert.equal(deployment.ownerId, VERCEL_TEAM_ID, `${role} team mismatch`);
  assert.equal(deployment.url, expected.url, `${role} immutable URL mismatch`);
  assert.equal(deployment.readyState, "READY", `${role} is not READY`);
  assert.equal(deployment.target, expected.target, `${role} target mismatch`);
  assert.equal(deployment.source.branch, expected.branch, `${role} branch mismatch`);
  assert.equal(deployment.source.sha, expected.sha, `${role} SHA mismatch`);
  assert.equal(
    deployment.aliases.includes("news.investwithraj.com"),
    expected.ownsCanonicalAlias,
    expected.ownsCanonicalAlias
      ? `${role} aliases must include canonical news.investwithraj.com`
      : `${role} aliases must exclude canonical news.investwithraj.com`,
  );
}

export async function captureVercelProviderSnapshot({
  config,
  environment = process.env,
  fetchImpl = globalThis.fetch,
  includePreview = false,
}) {
  const requestProvider = providerRequester(environment, fetchImpl);
  const [projectRaw, environmentRaw, productionRaw] = await Promise.all([
    requestProvider(`/v9/projects/${VERCEL_PROJECT_ID}`),
    readAllProviderEnvironment(requestProvider),
    requestProvider(`/v13/deployments/${config.productionDeploymentId}`),
  ]);
  const project = sanitizeProject(projectRaw);
  const environmentKeys = sanitizeEnvironment(environmentRaw);
  const production = sanitizeDeployment(productionRaw);
  validateProject(project);
  for (const forbiddenKey of [
    "NEWSROOM_LIFECYCLE_CUTOVER",
    "NEWSROOM_EVIDENCE_HOLD_PREVIEW",
    "NEWSROOM_VERCEL_PROTECTION_BYPASS",
    VERCEL_PROVIDER_CREDENTIAL_ENV,
  ]) {
    assert.equal(
      environmentKeys.some((entry) => entry.key === forbiddenKey),
      false,
      `${forbiddenKey} must remain absent from Vercel project env`,
    );
  }
  validateDeployment(
    production,
    {
      branch: VERCEL_PRODUCTION_BRANCH,
      id: config.productionDeploymentId,
      ownsCanonicalAlias: true,
      sha: config.productionSha,
      target: "production",
      url: config.productionUrl,
    },
    "Production",
  );
  let preview = null;
  if (includePreview) {
    const previewRaw = await requestProvider(
      `/v13/deployments/${config.previewDeploymentId}`,
    );
    preview = sanitizeDeployment(previewRaw);
    validateDeployment(
      preview,
      {
        branch: config.previewBranch,
        id: config.previewDeploymentId,
        ownsCanonicalAlias: false,
        sha: config.candidateSha,
        target: "preview",
        url: config.previewUrl,
      },
      "Preview",
    );
  }
  return Object.freeze({ environmentKeys, preview, production, project });
}

async function capturePublicRoutes(config, fetchImpl) {
  const routes = [];
  for (const route of PUBLIC_ROUTES) {
    const url = new URL(route.path, config.publicProductionUrl);
    const response = await rawRequest(fetchImpl, url);
    sameOrigin(response, url, `Public Production ${route.path}`);
    assert.equal(response.status, 200, `Public Production ${route.path} must return 200`);
    const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
    if (route.kind === "html") assert.match(contentType, /^text\/html(?:;|$)/u);
    if (route.kind === "xml") assert.match(contentType, /xml/u);
    if (route.kind === "text") assert.match(contentType, /^text\/plain(?:;|$)/u);
    const body = await response.text();
    const identity =
      route.kind === "html"
        ? htmlIdentity(body, config.publicProductionUrl, route.path)
        : { bodySha256: sha256(body) };
    routes.push({
      ...identity,
      contentType,
      path: route.path,
      robots: robotsHeader(response),
      status: response.status,
    });
  }
  return routes;
}

export async function capturePublicProductionIdentities({
  environment = process.env,
  fetchImpl = globalThis.fetch,
} = {}) {
  const config = parseInvarianceConfiguration(environment);
  assert.equal(config.phase, "before", "Before phase is required");
  const provider = await captureVercelProviderSnapshot({
    config,
    environment,
    fetchImpl,
  });
  const routes = await capturePublicRoutes(config, fetchImpl);
  return Object.freeze({
    schemaVersion: 2,
    phase: "before",
    provider,
    publicProductionUrl: config.publicProductionUrl,
    routes,
    result: "pass",
  });
}

function assertProtected(response, requested, label) {
  assert.ok([302, 401].includes(response.status), `${label} is anonymously accessible`);
  assert.ok(robotsHeader(response).includes("noindex"), `${label} lacks noindex`);
  if (response.status === 302) {
    const location = response.headers.get("location");
    assert.ok(location, `${label} challenge lacks location`);
    const destination = new URL(location, requested);
    assert.notEqual(destination.origin, requested.origin, `${label} redirects inside app`);
    assert.ok(
      destination.hostname === "vercel.com" || destination.hostname.endsWith(".vercel.com"),
      `${label} challenge is not Vercel authentication`,
    );
  }
  return { robots: robotsHeader(response), status: response.status };
}

async function authenticatedIdentity(fetchImpl, auth, origin, buildId, label) {
  const rootUrl = new URL("/", origin);
  const response = await fetchImpl(
    rootUrl,
    auth.fetchOptions({ redirect: "manual", signal: AbortSignal.timeout(TIMEOUT_MS) }),
  );
  sameOrigin(response, rootUrl, label);
  assert.equal(response.status, 200, `${label} root must return 200`);
  assert.match(response.headers.get("content-type")?.toLowerCase() ?? "", /^text\/html(?:;|$)/u);
  assert.ok(robotsHeader(response).includes("noindex"), `${label} root lacks noindex`);
  const body = await response.text();
  const h1 = body.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/iu)?.[1]
    ?.replace(/<[^>]+>/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
  assert.ok(h1, `${label} root has no H1`);

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
  return {
    buildAssetPath: buildPath,
    buildAssetStatus: buildResponse.status,
    h1,
    robots: robotsHeader(response),
    status: response.status,
  };
}

export async function runHostedNewsroomInvariance({
  baseline,
  environment = process.env,
  fetchImpl = globalThis.fetch,
} = {}) {
  const config = parseInvarianceConfiguration(environment);
  assert.equal(config.phase, "after", "After phase is required");
  assert.equal(baseline?.schemaVersion, 2, "Invalid Production baseline");
  assert.equal(baseline?.phase, "before", "Production baseline must be before phase");
  assert.equal(baseline?.publicProductionUrl, config.publicProductionUrl);
  assert.deepEqual(
    baseline?.routes?.map((route) => route.path),
    PUBLIC_ROUTES.map((route) => route.path),
    "Production baseline route cohort drifted",
  );

  const providerAfter = await captureVercelProviderSnapshot({
    config,
    environment,
    fetchImpl,
    includePreview: true,
  });
  assert.deepEqual(
    {
      environmentKeys: providerAfter.environmentKeys,
      preview: null,
      production: providerAfter.production,
      project: providerAfter.project,
    },
    baseline.provider,
    "Vercel project, env or Production deployment changed after Preview creation",
  );

  const auth = createProtectedPreviewAuth(
    NEWSROOM_PROTECTION_BYPASS_ENV,
    environment,
  );
  assert.equal(auth.authConfigured, true, "Hosted invariance requires newsroom auth");

  const previewRoot = new URL("/", config.previewUrl);
  const productionRoot = new URL("/", config.productionUrl);
  const previewAnonymous = assertProtected(
    await rawRequest(fetchImpl, previewRoot),
    previewRoot,
    "Preview",
  );
  const productionAnonymous = assertProtected(
    await rawRequest(fetchImpl, productionRoot),
    productionRoot,
    "Immutable Production",
  );
  const previewAuthenticated = await authenticatedIdentity(
    fetchImpl,
    auth,
    config.previewUrl,
    config.candidateBuildId,
    "Preview",
  );
  const productionAuthenticated = await authenticatedIdentity(
    fetchImpl,
    auth,
    config.productionUrl,
    config.productionBuildId,
    "Immutable Production",
  );

  const afterRoutes = await capturePublicRoutes(config, fetchImpl);
  assert.deepEqual(afterRoutes, baseline.routes, "Public Production changed after Preview creation");
  const publicRoot = afterRoutes.find((route) => route.path === "/");
  assert.equal(
    productionAuthenticated.h1,
    publicRoot?.h1,
    "Immutable and public Production root identities differ",
  );

  return Object.freeze({
    schemaVersion: 1,
    phase: "after",
    authConfigured: auth.authConfigured,
    expectation: {
      runtimeMode: "default",
      previewEnvironment: {
        NEWSROOM_EVIDENCE_HOLD_PREVIEW: "unset",
        NEWSROOM_LIFECYCLE_CUTOVER: "unset",
        VERCEL_ENV: "preview",
      },
      productionEnvironment: { VERCEL_ENV: "production" },
    },
    preview: {
      anonymousProtection: previewAnonymous,
      authenticated: previewAuthenticated,
      buildId: config.candidateBuildId,
      sha: config.candidateSha,
      url: config.previewUrl,
      deployment: providerAfter.preview,
    },
    production: {
      anonymousProtection: productionAnonymous,
      authenticated: productionAuthenticated,
      buildId: config.productionBuildId,
      publicUrl: config.publicProductionUrl,
      sha: config.productionSha,
      url: config.productionUrl,
      deployment: providerAfter.production,
    },
    provider: {
      environmentKeys: providerAfter.environmentKeys,
      project: providerAfter.project,
    },
    invariance: {
      after: afterRoutes,
      before: baseline.routes,
      equal: true,
      routeCount: PUBLIC_ROUTES.length,
    },
    requests: { after: 14, before: 7 },
    result: "pass",
  });
}

async function main() {
  const config = parseInvarianceConfiguration(process.env);
  const receipt =
    config.phase === "before"
      ? await capturePublicProductionIdentities()
      : await runHostedNewsroomInvariance({
          baseline: JSON.parse(readFileSync(config.baselinePath, "utf8")),
        });
  await mkdir(path.dirname(config.auditOutput), { recursive: true });
  await writeFile(config.auditOutput, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
  console.log(
    config.phase === "before"
      ? `Newsroom Production baseline captured: ${receipt.routes.length}/4 identities.`
      : `Newsroom hosted invariance passed: ${receipt.invariance.routeCount}/4 Production identities unchanged, Preview and immutable Production protected, auth ${receipt.authConfigured}.`,
  );
}

const isMain =
  process.argv[1] !== undefined &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (isMain) await main();
