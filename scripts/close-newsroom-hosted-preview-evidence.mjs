#!/usr/bin/env node

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

export const EXPECTED_RUNTIME_SHA =
  "54c35668f90dcdf696785c6fd5cc6e67a268e866";
export const EXPECTED_RUNTIME_TREE =
  "72b9a20648cf5ae70efea9f2fd2b572a0c40c744";
export const EXPECTED_TOOLING_SHA =
  "0aabdefaccceaf97fcc336ddcc1ab2c11a7eb145";
export const EXPECTED_TOOLING_TREE =
  "ae3e25a024b6656a8a7625f70392cd15f02120cb";
export const EXPECTED_LOCAL_BUILD_ID = "Vw3nq0gSlyv08qacF7Xo8";

const VERCEL_PROJECT_ID = "prj_kfTRKu4x1NZThilS9JTJTFt8S47h";
const VERCEL_TEAM_ID = "team_fX0MDhZugKxOW3rijXKAgYiA";
const IMMUTABLE_NEWSROOM_HOST =
  /^news-investwithraj-site-[a-z0-9]{8,16}-office-2271s-projects\.vercel\.app$/u;
const PREVIEW_ALIAS_HOST =
  /^news-investwithraj-site(?:-[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)?-office-2271s-projects\.vercel\.app$/u;

const AUTHORITY_MANIFEST_PATH =
  "docs/migration/HOSTED-PREVIEW-LOCAL-EVIDENCE-54C3566.json";
const DEFAULT_CLOSURE_OUTPUT =
  "outputs/hosted-readiness-54c3566/hosted-evidence-closure.json";
const SECRET_SENTINEL_ENVIRONMENTS = Object.freeze([
  "NEWSROOM_VERCEL_API_TOKEN",
  "NEWSROOM_VERCEL_PROTECTION_BYPASS",
  "IWR_VERCEL_PROTECTION_BYPASS",
  "NEWSROOM_HOSTED_SECRET_SENTINEL",
]);
const OPERATOR_ADDITIONS = Object.freeze([
  "docs/migration/HOSTED-PREVIEW-READINESS-54C3566-2026-08-19.md",
  AUTHORITY_MANIFEST_PATH,
  "docs/migration/evidence/hosted-readiness-54c3566/default-runtime.json",
  "docs/migration/evidence/hosted-readiness-54c3566/media-delivery.json",
  "scripts/close-newsroom-hosted-preview-evidence.mjs",
  "scripts/test-newsroom-hosted-receipt-closure.mjs",
]);
const PINNED_AUDIT_INPUTS = Object.freeze([
  "app",
  "components",
  "config",
  "content",
  "lib",
  "public",
  "proxy.ts",
  "next.config.ts",
  "docs/migration/news-url-disposition.csv",
  "docs/migration/newsroom-legacy-evidence-remediation.json",
]);
const EXPECTED_HOSTED_RECEIPTS = Object.freeze([
  {
    id: "provider-preflight",
    path: "outputs/hosted-readiness-54c3566/hosted-provider-preflight.json",
    repeatPath:
      "outputs/hosted-readiness-54c3566/hosted-provider-preflight-repeat.json",
    repeatByteDeterministic: true,
    repeatRequired: true,
    timestamped: false,
  },
  {
    id: "production-before",
    path: "outputs/hosted-readiness-54c3566/hosted-production-before.json",
    repeatByteDeterministic: true,
    repeatRequired: false,
    timestamped: false,
  },
  {
    id: "invariance-after",
    path: "outputs/hosted-readiness-54c3566/hosted-invariance-after.json",
    repeatPath:
      "outputs/hosted-readiness-54c3566/hosted-invariance-after-repeat.json",
    repeatByteDeterministic: true,
    repeatRequired: true,
    timestamped: false,
  },
  {
    id: "media-delivery",
    path: "outputs/hosted-readiness-54c3566/hosted-media-delivery.json",
    repeatPath:
      "outputs/hosted-readiness-54c3566/hosted-media-delivery-repeat.json",
    repeatByteDeterministic: true,
    repeatRequired: true,
    timestamped: false,
  },
  {
    id: "browser",
    path: "outputs/hosted-readiness-54c3566/hosted-browser.json",
    repeatPath: "outputs/hosted-readiness-54c3566/hosted-browser-repeat.json",
    repeatByteDeterministic: true,
    repeatRequired: true,
    timestamped: false,
  },
  {
    id: "default-runtime",
    path: "outputs/hosted-readiness-54c3566/hosted-default-runtime.json",
    repeatPath:
      "outputs/hosted-readiness-54c3566/hosted-default-runtime-repeat.json",
    repeatByteDeterministic: true,
    repeatRequired: true,
    timestamped: false,
  },
  {
    id: "batch-8",
    path: "outputs/hosted-readiness-54c3566/batch-8/report.json",
    repeatByteDeterministic: false,
    repeatRequired: false,
    timestamped: true,
  },
  {
    id: "batch-9",
    path: "outputs/hosted-readiness-54c3566/batch-9/report.json",
    repeatByteDeterministic: false,
    repeatRequired: false,
    timestamped: true,
  },
]);

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex").toUpperCase();
}

function normalizedPath(filePath) {
  return filePath.replaceAll("\\", "/");
}

function resolveInsideWorktree(root, value, label, { mustExist = true } = {}) {
  assert.equal(typeof value, "string", `${label} must be a string`);
  assert.equal(value, value.trim(), `${label} has outer whitespace`);
  assert.equal(/[\u0000-\u001f\u007f]/u.test(value), false, `${label} has controls`);
  const resolved = path.resolve(root, value);
  const relation = path.relative(root, resolved);
  assert.ok(
    relation !== "" && !relation.startsWith("..") && !path.isAbsolute(relation),
    `${label} must resolve inside the newsroom worktree`,
  );
  if (mustExist) {
    assert.equal(existsSync(resolved), true, `${label} does not exist`);
    const realRoot = realpathSync(root);
    const realFile = realpathSync(resolved);
    const realRelation = path.relative(realRoot, realFile);
    assert.ok(
      realRelation !== "" &&
        !realRelation.startsWith("..") &&
        !path.isAbsolute(realRelation),
      `${label} escapes the newsroom worktree`,
    );
  } else {
    let existingAncestor = path.dirname(resolved);
    while (!existsSync(existingAncestor)) {
      const parent = path.dirname(existingAncestor);
      assert.notEqual(parent, existingAncestor, `${label} has no existing parent`);
      existingAncestor = parent;
    }
    const realRoot = realpathSync(root);
    const realAncestor = realpathSync(existingAncestor);
    const ancestorRelation = path.relative(realRoot, realAncestor);
    assert.ok(
      ancestorRelation === "" ||
        (!ancestorRelation.startsWith("..") && !path.isAbsolute(ancestorRelation)),
      `${label} parent escapes the newsroom worktree`,
    );
  }
  return resolved;
}

function parseJson(bytes, label) {
  try {
    return JSON.parse(bytes.toString("utf8"));
  } catch {
    throw new Error(`${label} is not valid JSON`);
  }
}

export function validateAuthorityManifest(manifest) {
  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.kind, "newsroom-hosted-preview-local-evidence");
  assert.equal(manifest.runtimeSha, EXPECTED_RUNTIME_SHA);
  assert.equal(manifest.runtimeTree, EXPECTED_RUNTIME_TREE);
  assert.equal(manifest.toolingSha, EXPECTED_TOOLING_SHA);
  assert.equal(manifest.toolingTree, EXPECTED_TOOLING_TREE);
  assert.equal(manifest.buildId, EXPECTED_LOCAL_BUILD_ID);
  assert.equal(manifest.localEvidence?.length, 2);
  assert.deepEqual(
    manifest.hostedReceiptContract,
    EXPECTED_HOSTED_RECEIPTS,
    "Hosted receipt contract drifted",
  );
  return manifest;
}

function validateDefaultRuntimeReceipt(receipt, counts, buildId = EXPECTED_LOCAL_BUILD_ID) {
  assert.equal(receipt.schemaVersion, "newsroom-evidence-hold-served-runtime-v1");
  assert.equal(receipt.candidateSha, EXPECTED_RUNTIME_SHA);
  assert.equal(receipt.buildId, buildId);
  assert.equal(receipt.mode, "default");
  assert.equal(receipt.buildProbe?.status, 200);
  assert.deepEqual(receipt.expectation, {
    discoveryArticleCount: 41,
    developerReportCount: 6,
    evidenceHoldEnabled: false,
    frontItemCount: 6,
    lifecycleRedirectCount: 0,
    removalGoneCount: 0,
    rssItemCount: 30,
    sitemapCount: 79,
  });
  assert.equal(receipt.discovery?.sitemap?.paths?.length, counts.sitemap);
  assert.equal(receipt.discovery?.newsArchive?.articleSlugs?.length, counts.discoveryArticles);
  assert.equal(receipt.discovery?.developers?.reportSlugs?.length, counts.developerReports);
  assert.equal(receipt.discovery?.front?.itemSlugs?.length, counts.frontItems);
  assert.equal(receipt.discovery?.rss?.articleSlugs?.length, counts.rssItems);
  assert.equal(receipt.heldArticles?.length, counts.heldArticles);
  assert.equal(receipt.certifiedArticles?.length, counts.certifiedArticles);
  assert.equal(receipt.lifecycleRedirects?.length, counts.lifecycleRedirectSources);
  assert.equal(receipt.heldRedirects?.length, counts.heldRedirects);
  assert.equal(receipt.removals?.length, counts.removals);
  assert.equal(receipt.controls?.length, counts.controls);
}

function validateMediaReceipt(receipt, counts, buildId = EXPECTED_LOCAL_BUILD_ID) {
  assert.equal(receipt.schemaVersion, 1);
  assert.equal(receipt.candidate?.sha, EXPECTED_RUNTIME_SHA);
  assert.equal(receipt.candidate?.buildId, buildId);
  assert.equal(receipt.candidate?.buildAssetStatus, 200);
  assert.equal(receipt.expectation, "protected-preview");
  assert.equal(receipt.result, "pass");
  assert.equal(receipt.authority?.exactPaths, counts.approvedPaths);
  assert.equal(receipt.authority?.withheld, counts.withheld);
  assert.equal(receipt.authority?.unknownOnDisk, counts.unknownOnDisk);
  assert.equal(receipt.requests?.head?.passed, counts.approvedHead);
  assert.equal(receipt.requests?.get?.passed, counts.rangedGet);
  assert.equal(receipt.requests?.denied?.passed, counts.deniedHead);
  assert.equal(receipt.requests?.total, counts.total);
}

export function verifyLocalEvidence(root, manifest, sentinels = []) {
  const records = [];
  for (const evidence of manifest.localEvidence) {
    const absolutePath = resolveInsideWorktree(root, evidence.path, evidence.id);
    const bytes = readFileSync(absolutePath);
    assert.equal(bytes.byteLength, evidence.bytes, `${evidence.id} byte count drifted`);
    assert.equal(sha256(bytes), evidence.sha256, `${evidence.id} hash drifted`);
    assertNoSecretSentinels(bytes, sentinels, evidence.id);
    const receipt = parseJson(bytes, evidence.id);
    if (evidence.id === "default-runtime") {
      validateDefaultRuntimeReceipt(receipt, evidence.counts);
      assert.equal(receipt.authConfigured, false);
    } else if (evidence.id === "media-delivery") {
      validateMediaReceipt(receipt, evidence.counts);
      assert.equal(receipt.authConfigured, false);
    } else {
      assert.fail(`Unknown local evidence ${evidence.id}`);
    }
    records.push({
      bytes: evidence.bytes,
      id: evidence.id,
      path: evidence.path,
      repeatByteDeterministic: evidence.repeatByteDeterministic,
      sha256: evidence.sha256,
    });
  }
  return records.toSorted((left, right) => left.id.localeCompare(right.id));
}

function git(root, args, allowedStatuses = [0]) {
  const result = spawnSync("git", args, {
    cwd: root,
    encoding: "utf8",
    windowsHide: true,
  });
  assert.equal(result.error, undefined, "Git invocation failed");
  assert.ok(
    allowedStatuses.includes(result.status),
    `Git ${args[0]} failed without exposing command output`,
  );
  return { status: result.status, stdout: result.stdout.trim() };
}

function isOperatorAddition(filePath) {
  const candidate = normalizedPath(filePath).replace(/^"|"$/gu, "");
  return OPERATOR_ADDITIONS.includes(candidate);
}

export function validateOperatorStatus(
  status,
  { allowDevelopmentWorktree = false } = {},
) {
  assert.ok(Array.isArray(status), "Git status must be an array");
  if (!allowDevelopmentWorktree) {
    assert.deepEqual(status, [], "The exact operator tooling tree must be committed and clean");
    return true;
  }
  for (const line of status.filter((entry) => entry.startsWith("?? "))) {
    const filePath = line.slice(3);
    assert.ok(
      isOperatorAddition(filePath) ||
        filePath === "scripts/test-hosted-newsroom-provider-preflight.mjs" ||
        filePath === "scripts/test-hosted-newsroom-provider-preflight-contract.mjs",
      "Unexpected untracked development file",
    );
  }
  return status.length === 0;
}

export function verifyGitAuthority(
  root,
  manifest,
  { allowDevelopmentWorktree = false } = {},
) {
  const toolingCommit = git(root, [
    "rev-parse",
    "--verify",
    `${manifest.toolingSha}^{commit}`,
  ]).stdout;
  const runtimeCommit = git(root, [
    "rev-parse",
    "--verify",
    `${manifest.runtimeSha}^{commit}`,
  ]).stdout;
  assert.equal(toolingCommit, manifest.toolingSha);
  assert.equal(runtimeCommit, manifest.runtimeSha);
  assert.equal(
    git(root, ["rev-parse", `${manifest.toolingSha}^{tree}`]).stdout,
    manifest.toolingTree,
  );
  assert.equal(
    git(root, ["rev-parse", `${manifest.runtimeSha}^{tree}`]).stdout,
    manifest.runtimeTree,
  );
  git(root, ["merge-base", "--is-ancestor", manifest.runtimeSha, manifest.toolingSha]);
  git(root, ["merge-base", "--is-ancestor", manifest.toolingSha, "HEAD"]);
  git(root, [
    "diff",
    "--quiet",
    manifest.toolingSha,
    "--",
    ...PINNED_AUDIT_INPUTS,
  ]);

  const status = git(root, ["status", "--porcelain=v1", "--untracked-files=all"])
    .stdout.split(/\r?\n/gu)
    .filter(Boolean);
  const worktreeClean = validateOperatorStatus(status, {
    allowDevelopmentWorktree,
  });

  const head = git(root, ["rev-parse", "HEAD"]).stdout;
  const headTree = git(root, ["rev-parse", "HEAD^{tree}"]).stdout;
  return Object.freeze({
    head,
    headTree,
    runtimeAncestor: true,
    worktreeClean,
  });
}

export function configuredSecretSentinels(environment = process.env) {
  const values = [];
  for (const name of SECRET_SENTINEL_ENVIRONMENTS) {
    const value = environment[name];
    if (value === undefined || value === "") continue;
    assert.equal(typeof value, "string", "Secret sentinel must be a string");
    assert.ok(value.length >= 8, "Secret sentinel is too short for a safe scan");
    values.push(value);
  }
  return [...new Set(values)];
}

export function assertNoSecretSentinels(bytes, sentinels, label) {
  for (const sentinel of sentinels) {
    assert.equal(
      bytes.includes(Buffer.from(sentinel, "utf8")),
      false,
      `${label} contains a configured secret sentinel`,
    );
  }
}

function validateHostedReceipt(id, receipt, manifest, candidateBuildIds) {
  if (id === "provider-preflight") {
    assert.equal(receipt.schemaVersion, 1);
    assert.equal(receipt.result, "pass");
    assert.equal(receipt.authConfigured, true);
    assert.equal(receipt.project?.id, VERCEL_PROJECT_ID);
    assert.equal(receipt.project?.ownerId, VERCEL_TEAM_ID);
    assert.equal(receipt.project?.productionDeploymentId, receipt.production?.id);
    assert.ok(Array.isArray(receipt.environmentKeys));
    assert.deepEqual(
      receipt.environmentKeys,
      [...receipt.environmentKeys].toSorted((left, right) =>
        `${left.key}\0${left.type}\0${left.targets.join(",")}`.localeCompare(
          `${right.key}\0${right.type}\0${right.targets.join(",")}`,
        ),
      ),
      "Provider environment key set is not deterministic",
    );
    assert.equal(
      new Set(
        receipt.environmentKeys.map(
          (entry) => `${entry.key}\0${entry.type}\0${entry.targets.join(",")}`,
        ),
      ).size,
      receipt.environmentKeys.length,
      "Provider environment key set contains duplicates",
    );
    validateProviderDeployment(receipt.production, {
      canonicalAlias: true,
      role: "Provider Production",
      target: "production",
    });
    validateProviderDeployment(receipt.preview, {
      canonicalAlias: false,
      role: "Provider Preview",
      target: "preview",
    });
    assert.equal(receipt.production.source?.branch, "main");
    assert.equal(receipt.preview.source?.sha, manifest.runtimeSha);
    assert.notEqual(receipt.production.url, receipt.preview.url);
    candidateBuildIds.add(receipt.preview.buildId);
    return;
  }
  if (id === "production-before") {
    assert.equal(receipt.schemaVersion, 2);
    assert.equal(receipt.phase, "before");
    assert.equal(receipt.result, "pass");
    assert.equal(receipt.routes?.length, 4);
    assert.equal(receipt.provider?.project?.id, "prj_kfTRKu4x1NZThilS9JTJTFt8S47h");
    return;
  }
  if (id === "invariance-after") {
    assert.equal(receipt.schemaVersion, 1);
    assert.equal(receipt.phase, "after");
    assert.equal(receipt.result, "pass");
    assert.equal(receipt.authConfigured, true);
    assert.equal(receipt.preview?.sha, manifest.runtimeSha);
    assert.equal(receipt.preview?.deployment?.target, "preview");
    assert.equal(receipt.invariance?.equal, true);
    assert.equal(receipt.invariance?.routeCount, 4);
    candidateBuildIds.add(receipt.preview?.buildId);
    return;
  }
  if (id === "media-delivery") {
    validateMediaReceipt(
      receipt,
      {
        approvedHead: 16,
        approvedPaths: 16,
        deniedHead: 51,
        rangedGet: 3,
        total: 71,
        unknownOnDisk: 16,
        withheld: 31,
      },
      receipt.candidate?.buildId,
    );
    assert.equal(receipt.authConfigured, true);
    candidateBuildIds.add(receipt.candidate?.buildId);
    return;
  }
  if (id === "browser") {
    assert.equal(receipt.schemaVersion, 1);
    assert.equal(receipt.result, "pass");
    assert.equal(receipt.authConfigured, true);
    assert.equal(receipt.candidate?.sha, manifest.runtimeSha);
    assert.equal(receipt.candidate?.buildAssetStatus, 200);
    assert.equal(receipt.candidate?.expectedGeneratedPages, 98);
    assert.deepEqual(receipt.authority, {
      articleRoutes: 41,
      heldArticleRoutes: 24,
      htmlRoutes: 85,
      sitemapRoutes: 79,
      viewportCases: 170,
    });
    assert.equal(receipt.controls?.static?.length, 7);
    assert.equal(receipt.controls?.private?.length, 2);
    assert.equal(receipt.controls?.notFound?.length, 3);
    assert.deepEqual(receipt.findings, []);
    candidateBuildIds.add(receipt.candidate?.buildId);
    return;
  }
  if (id === "default-runtime") {
    validateDefaultRuntimeReceipt(
      receipt,
      {
        certifiedArticles: 2,
        controls: 3,
        developerReports: 6,
        discoveryArticles: 41,
        frontItems: 6,
        heldArticles: 24,
        heldRedirects: 3,
        lifecycleRedirectSources: 31,
        removals: 6,
        rssItems: 30,
        sitemap: 79,
      },
      receipt.buildId,
    );
    assert.equal(receipt.authConfigured, true);
    candidateBuildIds.add(receipt.buildId);
    return;
  }
  if (id === "batch-8") {
    assert.equal(receipt.batch, 8);
    assert.equal(receipt.mode, "production-browser");
    assert.equal(receipt.authConfigured, true);
    assert.equal(receipt.totals?.failed, 0);
    assert.deepEqual(receipt.failures, []);
    assert.equal(Number.isNaN(Date.parse(receipt.generatedAt)), false);
    return;
  }
  if (id === "batch-9") {
    assert.equal(receipt.batch, 9);
    assert.equal(receipt.mode, "production-browser");
    assert.equal(receipt.authConfigured?.newsroom, true);
    assert.equal(typeof receipt.authConfigured?.advisory, "boolean");
    assert.equal(receipt.totals?.failed, 0);
    assert.deepEqual(receipt.failures, []);
    assert.equal(Number.isNaN(Date.parse(receipt.generatedAt)), false);
    return;
  }
  assert.fail(`Unknown hosted receipt ${id}`);
}

function validateProviderDeployment(
  deployment,
  { canonicalAlias, role, target },
) {
  assert.match(deployment?.id ?? "", /^dpl_[A-Za-z0-9]+$/u, `${role} ID is invalid`);
  assert.equal(deployment?.projectId, VERCEL_PROJECT_ID, `${role} project drifted`);
  assert.equal(deployment?.ownerId, VERCEL_TEAM_ID, `${role} team drifted`);
  assert.equal(deployment?.readyState, "READY", `${role} is not READY`);
  assert.equal(deployment?.target, target, `${role} target drifted`);
  assert.match(deployment?.source?.sha ?? "", /^[0-9a-f]{40}$/u, `${role} SHA is invalid`);
  assert.equal(typeof deployment?.source?.branch, "string", `${role} branch is missing`);
  const url = new URL(deployment?.url);
  assert.equal(url.pathname, "/", `${role} URL is not an origin`);
  assert.match(url.hostname, IMMUTABLE_NEWSROOM_HOST, `${role} origin drifted`);
  assert.ok(Array.isArray(deployment?.aliases), `${role} aliases are missing`);
  assert.equal(new Set(deployment.aliases).size, deployment.aliases.length);
  assert.equal(
    deployment.aliases.includes("news.investwithraj.com"),
    canonicalAlias,
    `${role} canonical alias state drifted`,
  );
  if (!canonicalAlias) {
    for (const alias of deployment.aliases) {
      assert.match(alias, PREVIEW_ALIAS_HOST, `${role} has a custom alias`);
    }
  }
  assert.match(deployment?.buildId ?? "", /^[A-Za-z0-9_-]{8,128}$/u);
  assert.equal(
    deployment?.buildAssetPath,
    `/_next/static/${deployment.buildId}/_buildManifest.js`,
    `${role} build asset drifted`,
  );
}

function deploymentWithoutBuild(deployment) {
  const identity = { ...deployment };
  delete identity.buildAssetPath;
  delete identity.buildId;
  return identity;
}

function projectWithoutProductionDeployment(project) {
  const identity = { ...project };
  delete identity.productionDeploymentId;
  return identity;
}

function crossBindHostedReceipts(receipts) {
  const preflight = receipts.get("provider-preflight");
  const before = receipts.get("production-before");
  const after = receipts.get("invariance-after");
  assert.ok(preflight, "Provider preflight receipt is missing from closure");
  assert.ok(before, "Production-before receipt is missing from closure");
  assert.ok(after, "Invariance-after receipt is missing from closure");

  const productionIdentity = deploymentWithoutBuild(preflight.production);
  const previewIdentity = deploymentWithoutBuild(preflight.preview);
  const projectIdentity = projectWithoutProductionDeployment(preflight.project);
  assert.deepEqual(
    before.provider?.production,
    productionIdentity,
    "Production-before deployment does not match provider preflight",
  );
  assert.deepEqual(
    before.provider?.project,
    projectIdentity,
    "Production-before project does not match provider preflight",
  );
  assert.deepEqual(
    before.provider?.environmentKeys,
    preflight.environmentKeys,
    "Production-before environment set does not match provider preflight",
  );
  assert.deepEqual(
    after.production?.deployment,
    productionIdentity,
    "Invariance Production deployment does not match provider preflight",
  );
  assert.equal(
    after.production?.buildId,
    preflight.production.buildId,
    "Production build ID does not match provider preflight",
  );
  assert.equal(
    after.production?.sha,
    preflight.production.source.sha,
    "Production SHA does not match provider preflight",
  );
  assert.equal(
    after.production?.url,
    preflight.production.url,
    "Production origin does not match provider preflight",
  );
  assert.deepEqual(
    after.preview?.deployment,
    previewIdentity,
    "Invariance Preview deployment does not match provider preflight",
  );
  assert.equal(
    after.preview?.buildId,
    preflight.preview.buildId,
    "Preview build ID does not match provider preflight",
  );
  assert.equal(
    after.preview?.sha,
    preflight.preview.source.sha,
    "Preview SHA does not match provider preflight",
  );
  assert.equal(
    after.preview?.url,
    preflight.preview.url,
    "Preview origin does not match provider preflight",
  );
  assert.deepEqual(
    after.provider?.project,
    projectIdentity,
    "Invariance project does not match provider preflight",
  );
  assert.deepEqual(
    after.provider?.environmentKeys,
    preflight.environmentKeys,
    "Invariance environment set does not match provider preflight",
  );
}

function receiptRecord(spec, bytes, repeatBytes) {
  const record = {
    bytes: bytes.byteLength,
    id: spec.id,
    path: spec.path,
    repeatByteDeterministic: spec.repeatByteDeterministic,
    repeatRequired: spec.repeatRequired,
    sha256: sha256(bytes),
    timestamped: spec.timestamped,
  };
  if (repeatBytes !== undefined) {
    record.repeat = {
      bytes: repeatBytes.byteLength,
      path: spec.repeatPath,
      sha256: sha256(repeatBytes),
    };
  }
  return record;
}

export function buildClosureManifest({
  authority,
  hostedReceiptBytes,
  localEvidence,
  operatorHead,
  operatorTree,
  sentinels = [],
}) {
  assert.match(operatorHead, /^[0-9a-f]{40}$/u, "Operator tooling SHA is invalid");
  assert.match(operatorTree, /^[0-9a-f]{40}$/u, "Operator tooling tree is invalid");
  const candidateBuildIds = new Set();
  const parsedReceipts = new Map();
  const hostedReceipts = [];
  for (const spec of authority.hostedReceiptContract) {
    const bytes = hostedReceiptBytes.get(spec.path);
    assert.ok(Buffer.isBuffer(bytes), `${spec.id} receipt is missing`);
    assertNoSecretSentinels(bytes, sentinels, spec.id);
    const receipt = parseJson(bytes, spec.id);
    validateHostedReceipt(spec.id, receipt, authority, candidateBuildIds);
    parsedReceipts.set(spec.id, receipt);
    const repeatBytes = spec.repeatPath
      ? hostedReceiptBytes.get(spec.repeatPath)
      : undefined;
    if (spec.repeatRequired) {
      assert.ok(Buffer.isBuffer(repeatBytes), `${spec.id} repeat receipt is missing`);
      assertNoSecretSentinels(repeatBytes, sentinels, `${spec.id} repeat`);
      assert.equal(
        Buffer.compare(bytes, repeatBytes),
        0,
        `${spec.id} repeat receipt is not byte-deterministic`,
      );
    }
    hostedReceipts.push(receiptRecord(spec, bytes, repeatBytes));
  }
  crossBindHostedReceipts(parsedReceipts);
  assert.equal(candidateBuildIds.size, 1, "Hosted candidate build IDs disagree");
  const [hostedBuildId] = candidateBuildIds;
  assert.equal(typeof hostedBuildId, "string", "Hosted candidate build ID is missing");

  const closure = {
    schemaVersion: 1,
    kind: "newsroom-hosted-preview-evidence-closure",
    runtimeSha: authority.runtimeSha,
    localEvidenceToolingSha: authority.toolingSha,
    toolingSha: operatorHead,
    toolingTree: operatorTree,
    localBuildId: authority.buildId,
    hostedBuildId,
    authorityManifest: AUTHORITY_MANIFEST_PATH,
    localEvidence,
    hostedReceipts: hostedReceipts.toSorted((left, right) =>
      left.id.localeCompare(right.id),
    ),
    secretScan: { configured: sentinels.length > 0, matches: 0 },
    result: "pass",
  };
  const serialized = Buffer.from(`${JSON.stringify(closure, null, 2)}\n`, "utf8");
  assertNoSecretSentinels(serialized, sentinels, "closure manifest");
  return { closure, serialized };
}

export function readHostedReceiptBytes(root, manifest) {
  const receipts = new Map();
  for (const spec of manifest.hostedReceiptContract) {
    for (const receiptPath of [spec.path, spec.repeatPath].filter(Boolean)) {
      const absolutePath = resolveInsideWorktree(root, receiptPath, receiptPath);
      receipts.set(receiptPath, readFileSync(absolutePath));
    }
  }
  return receipts;
}

function readAuthorityManifest(root) {
  const manifestPath = resolveInsideWorktree(root, AUTHORITY_MANIFEST_PATH, "authority manifest");
  return validateAuthorityManifest(parseJson(readFileSync(manifestPath), "authority manifest"));
}

async function main() {
  const root = realpathSync(process.cwd());
  const authority = readAuthorityManifest(root);
  const gitAuthority = verifyGitAuthority(root, authority);
  const sentinels = configuredSecretSentinels(process.env);
  const localEvidence = verifyLocalEvidence(root, authority, sentinels);
  const hostedReceiptBytes = readHostedReceiptBytes(root, authority);
  const { closure, serialized } = buildClosureManifest({
    authority,
    hostedReceiptBytes,
    localEvidence,
    operatorHead: gitAuthority.head,
    operatorTree: gitAuthority.headTree,
    sentinels,
  });
  const outputValue =
    process.env.NEWSROOM_HOSTED_CLOSURE_OUTPUT ?? DEFAULT_CLOSURE_OUTPUT;
  const outputPath = resolveInsideWorktree(root, outputValue, "closure output", {
    mustExist: false,
  });
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, serialized);
  console.log(
    `Newsroom hosted evidence closure PASS: ${closure.hostedReceipts.length} hosted receipts, ${closure.localEvidence.length} local receipts, secrets ${closure.secretScan.configured ? "configured and absent" : "not configured"}.`,
  );
}

const isMain =
  process.argv[1] !== undefined &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (isMain) await main();
