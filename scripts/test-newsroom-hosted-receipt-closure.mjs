#!/usr/bin/env node

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import path from "node:path";

import {
  EXPECTED_RUNTIME_SHA,
  EXPECTED_TOOLING_SHA,
  buildClosureManifest,
  configuredSecretSentinels,
  validateAuthorityManifest,
  validateOperatorStatus,
  verifyGitAuthority,
  verifyLocalEvidence,
} from "./close-newsroom-hosted-preview-evidence.mjs";

const root = realpathSync(process.cwd());
const manifestPath = path.join(
  root,
  "docs/migration/HOSTED-PREVIEW-LOCAL-EVIDENCE-54C3566.json",
);
const authority = validateAuthorityManifest(
  JSON.parse(readFileSync(manifestPath, "utf8")),
);
assert.equal(authority.runtimeSha, EXPECTED_RUNTIME_SHA);
assert.equal(authority.toolingSha, EXPECTED_TOOLING_SHA);
const closureSource = readFileSync(
  path.join(root, "scripts/close-newsroom-hosted-preview-evidence.mjs"),
  "utf8",
);
assert.match(
  closureSource,
  /const gitAuthority = verifyGitAuthority\(root, authority\);/u,
  "The executable closure must use strict committed-and-clean Git authority",
);

const gitAuthority = verifyGitAuthority(root, authority, {
  allowDevelopmentWorktree: true,
});
assert.equal(gitAuthority.runtimeAncestor, true);
assert.match(gitAuthority.head, /^[0-9a-f]{40}$/u);
assert.match(gitAuthority.headTree, /^[0-9a-f]{40}$/u);
assert.equal(validateOperatorStatus([]), true);
assert.throws(
  () => validateOperatorStatus([" M scripts/test-newsroom-hosted-browser.mjs"]),
  /must be committed and clean/u,
);

const localEvidence = verifyLocalEvidence(root, authority);
assert.deepEqual(
  localEvidence.map((record) => [record.id, record.bytes, record.sha256]),
  [
    [
      "default-runtime",
      66516,
      "8806976FD2980BAB389F47C798DD96BA1472AB1223104578BC4CF022E5635E76",
    ],
    [
      "media-delivery",
      9639,
      "110C555EFD7E6FA308D532D097A48B39C45946FAFDB4ECA3692B12010406F358",
    ],
  ],
);
for (const evidence of authority.localEvidence) {
  const ignoredSource = path.join(root, evidence.sourcePath);
  if (!existsSync(ignoredSource)) continue;
  assert.deepEqual(
    readFileSync(path.join(root, evidence.path)),
    readFileSync(ignoredSource),
    `${evidence.id} portable copy differs from its retained local source`,
  );
}

const hostedBuildId = "HostedBuild_54c3566";
const localDefault = JSON.parse(
  readFileSync(path.join(root, authority.localEvidence[0].path), "utf8"),
);
const localMedia = JSON.parse(
  readFileSync(path.join(root, authority.localEvidence[1].path), "utf8"),
);

function bytes(value) {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function hostedFixtures(batchTimestamp = "2026-08-19T08:00:00.000Z") {
  const receipts = new Map();
  const environmentKeys = [
    { key: "NEXT_PUBLIC_SITE_NAME", targets: ["preview", "production"], type: "plain" },
  ];
  const projectIdentity = {
    autoAssignCustomDomains: true,
    framework: "nextjs",
    git: {
      org: "investwithraj",
      productionBranch: "main",
      repo: "news-investwithraj-site",
      repoId: "1248443593",
      type: "github",
    },
    gitForkProtection: true,
    id: "prj_kfTRKu4x1NZThilS9JTJTFt8S47h",
    name: "news-investwithraj-site",
    nodeVersion: "24.x",
    ownerId: "team_fX0MDhZugKxOW3rijXKAgYiA",
    protectionBypassCount: 1,
    ssoProtection: "all_except_custom_domains",
  };
  const productionIdentity = {
    aliases: ["news.investwithraj.com"],
    id: "dpl_Production123",
    ownerId: "team_fX0MDhZugKxOW3rijXKAgYiA",
    projectId: "prj_kfTRKu4x1NZThilS9JTJTFt8S47h",
    readyState: "READY",
    source: { branch: "main", sha: "a".repeat(40) },
    target: "production",
    url: "https://news-investwithraj-site-prod12345-office-2271s-projects.vercel.app",
  };
  const previewIdentity = {
    aliases: [
      "news-investwithraj-site-git-proposed-office-2271s-projects.vercel.app",
    ],
    id: "dpl_Preview123",
    ownerId: "team_fX0MDhZugKxOW3rijXKAgYiA",
    projectId: "prj_kfTRKu4x1NZThilS9JTJTFt8S47h",
    readyState: "READY",
    source: { branch: "codex/iwr-newsroom-preview-54c3566", sha: EXPECTED_RUNTIME_SHA },
    target: "preview",
    url: "https://news-investwithraj-site-prev12345-office-2271s-projects.vercel.app",
  };
  const providerPreflight = {
    schemaVersion: 1,
    authConfigured: true,
    project: {
      ...projectIdentity,
      productionDeploymentId: productionIdentity.id,
    },
    environmentKeys,
    production: {
      ...productionIdentity,
      buildAssetPath: "/_next/static/ProductionBuild_123/_buildManifest.js",
      buildId: "ProductionBuild_123",
    },
    preview: {
      ...previewIdentity,
      buildAssetPath: `/_next/static/${hostedBuildId}/_buildManifest.js`,
      buildId: hostedBuildId,
    },
    providerRequests: 6,
    result: "pass",
  };
  const productionBefore = {
    schemaVersion: 2,
    phase: "before",
    provider: {
      environmentKeys,
      preview: null,
      production: productionIdentity,
      project: projectIdentity,
    },
    routes: [{}, {}, {}, {}],
    result: "pass",
  };
  const invarianceAfter = {
    schemaVersion: 1,
    phase: "after",
    authConfigured: true,
    preview: {
      buildId: hostedBuildId,
      sha: EXPECTED_RUNTIME_SHA,
      url: previewIdentity.url,
      deployment: previewIdentity,
    },
    production: {
      buildId: providerPreflight.production.buildId,
      sha: productionIdentity.source.sha,
      url: productionIdentity.url,
      deployment: productionIdentity,
    },
    provider: { environmentKeys, project: projectIdentity },
    invariance: { equal: true, routeCount: 4 },
    result: "pass",
  };
  const media = structuredClone(localMedia);
  media.authConfigured = true;
  media.candidate.buildId = hostedBuildId;
  media.candidate.buildAssetPath =
    `/_next/static/${hostedBuildId}/_buildManifest.js`;
  const browser = {
    schemaVersion: 1,
    authConfigured: true,
    candidate: {
      buildAssetStatus: 200,
      buildId: hostedBuildId,
      expectedGeneratedPages: 98,
      sha: EXPECTED_RUNTIME_SHA,
    },
    authority: {
      articleRoutes: 41,
      heldArticleRoutes: 24,
      htmlRoutes: 85,
      sitemapRoutes: 79,
      viewportCases: 170,
    },
    controls: {
      notFound: [{}, {}, {}],
      private: [{}, {}],
      static: [{}, {}, {}, {}, {}, {}, {}],
    },
    findings: [],
    result: "pass",
  };
  const defaultRuntime = structuredClone(localDefault);
  defaultRuntime.authConfigured = true;
  defaultRuntime.buildId = hostedBuildId;
  const batch8 = {
    batch: 8,
    generatedAt: batchTimestamp,
    mode: "production-browser",
    authConfigured: true,
    totals: { failed: 0 },
    failures: [],
  };
  const batch9 = {
    batch: 9,
    generatedAt: batchTimestamp,
    mode: "production-browser",
    authConfigured: { newsroom: true, advisory: false },
    totals: { failed: 0 },
    failures: [],
  };
  const primary = new Map([
    ["provider-preflight", providerPreflight],
    ["production-before", productionBefore],
    ["invariance-after", invarianceAfter],
    ["media-delivery", media],
    ["browser", browser],
    ["default-runtime", defaultRuntime],
    ["batch-8", batch8],
    ["batch-9", batch9],
  ]);
  for (const spec of authority.hostedReceiptContract) {
    const receiptBytes = bytes(primary.get(spec.id));
    receipts.set(spec.path, receiptBytes);
    if (spec.repeatPath) receipts.set(spec.repeatPath, Buffer.from(receiptBytes));
  }
  return receipts;
}

function mutateReceipt(receipts, id, mutate) {
  const changed = new Map(receipts);
  const spec = authority.hostedReceiptContract.find((entry) => entry.id === id);
  const receipt = JSON.parse(changed.get(spec.path).toString("utf8"));
  mutate(receipt);
  const changedBytes = bytes(receipt);
  changed.set(spec.path, changedBytes);
  if (spec.repeatPath) changed.set(spec.repeatPath, Buffer.from(changedBytes));
  return changed;
}

const sentinel = "closure-sentinel-secret-8c3e8f";
const sentinels = configuredSecretSentinels({
  NEWSROOM_VERCEL_API_TOKEN: sentinel,
  NEWSROOM_VERCEL_PROTECTION_BYPASS: sentinel,
});
assert.equal(sentinels.length, 1);

const first = buildClosureManifest({
  authority,
  hostedReceiptBytes: hostedFixtures(),
  localEvidence,
  operatorHead: gitAuthority.head,
  operatorTree: gitAuthority.headTree,
  sentinels,
});
const second = buildClosureManifest({
  authority,
  hostedReceiptBytes: hostedFixtures(),
  localEvidence,
  operatorHead: gitAuthority.head,
  operatorTree: gitAuthority.headTree,
  sentinels,
});
assert.deepEqual(first.serialized, second.serialized);
assert.equal(first.serialized.includes(Buffer.from(sentinel)), false);
assert.equal(first.closure.runtimeSha, EXPECTED_RUNTIME_SHA);
assert.equal(first.closure.localEvidenceToolingSha, EXPECTED_TOOLING_SHA);
assert.equal(first.closure.toolingSha, gitAuthority.head);
assert.equal(first.closure.toolingTree, gitAuthority.headTree);
assert.equal(first.closure.hostedReceipts.length, 8);
assert.equal(first.closure.localEvidence.length, 2);
assert.equal(first.closure.secretScan.configured, true);
assert.equal(first.closure.secretScan.matches, 0);
assert.equal(
  first.closure.hostedReceipts.find((record) => record.id === "batch-8")
    ?.repeatByteDeterministic,
  false,
);
assert.equal(
  first.closure.hostedReceipts.find((record) => record.id === "batch-9")
    ?.timestamped,
  true,
);

const providerSpec = authority.hostedReceiptContract.find(
  (spec) => spec.id === "provider-preflight",
);
const missingProvider = hostedFixtures();
missingProvider.delete(providerSpec.path);
missingProvider.delete(providerSpec.repeatPath);
assert.throws(
  () =>
    buildClosureManifest({
      authority,
      hostedReceiptBytes: missingProvider,
      localEvidence,
      operatorHead: gitAuthority.head,
      operatorTree: gitAuthority.headTree,
      sentinels,
    }),
  /provider-preflight receipt is missing/u,
);

const deploymentDrift = mutateReceipt(
  hostedFixtures(),
  "production-before",
  (receipt) => {
    receipt.provider.production.id = "dpl_Drifted123";
  },
);
assert.throws(
  () =>
    buildClosureManifest({
      authority,
      hostedReceiptBytes: deploymentDrift,
      localEvidence,
      operatorHead: gitAuthority.head,
      operatorTree: gitAuthority.headTree,
      sentinels,
    }),
  /Production-before deployment does not match provider preflight/u,
);

const environmentDrift = mutateReceipt(
  hostedFixtures(),
  "invariance-after",
  (receipt) => {
    receipt.provider.environmentKeys = [];
  },
);
assert.throws(
  () =>
    buildClosureManifest({
      authority,
      hostedReceiptBytes: environmentDrift,
      localEvidence,
      operatorHead: gitAuthority.head,
      operatorTree: gitAuthority.headTree,
      sentinels,
    }),
  /Invariance environment set does not match provider preflight/u,
);

const buildDrift = mutateReceipt(
  hostedFixtures(),
  "invariance-after",
  (receipt) => {
    receipt.preview.buildId = "OtherHostedBuild_123";
  },
);
assert.throws(
  () =>
    buildClosureManifest({
      authority,
      hostedReceiptBytes: buildDrift,
      localEvidence,
      operatorHead: gitAuthority.head,
      operatorTree: gitAuthority.headTree,
      sentinels,
    }),
  /Preview build ID does not match provider preflight/u,
);

const changedTimestamp = buildClosureManifest({
  authority,
  hostedReceiptBytes: hostedFixtures("2026-08-19T08:00:01.000Z"),
  localEvidence,
  operatorHead: gitAuthority.head,
  operatorTree: gitAuthority.headTree,
  sentinels,
});
assert.notEqual(
  createHash("sha256").update(first.serialized).digest("hex"),
  createHash("sha256").update(changedTimestamp.serialized).digest("hex"),
  "Timestamped Batch receipts must remain hashable without pretending byte repeatability",
);

const repeatMismatch = hostedFixtures();
repeatMismatch.set(
  authority.hostedReceiptContract.find((spec) => spec.id === "browser").repeatPath,
  Buffer.from("{}\n"),
);
assert.throws(
  () =>
    buildClosureManifest({
      authority,
      hostedReceiptBytes: repeatMismatch,
      localEvidence,
      operatorHead: gitAuthority.head,
      operatorTree: gitAuthority.headTree,
      sentinels,
    }),
  /browser repeat receipt is not byte-deterministic/u,
);

const leaked = hostedFixtures();
const batch8Path = authority.hostedReceiptContract.find(
  (spec) => spec.id === "batch-8",
).path;
leaked.set(batch8Path, bytes({ secret: sentinel }));
let leakMessage = "";
try {
  buildClosureManifest({
    authority,
    hostedReceiptBytes: leaked,
    localEvidence,
    operatorHead: gitAuthority.head,
    operatorTree: gitAuthority.headTree,
    sentinels,
  });
  assert.fail("A secret-bearing receipt must fail closed");
} catch (error) {
  leakMessage = String(error?.message ?? error);
}
assert.match(leakMessage, /configured secret sentinel/u);
assert.equal(leakMessage.includes(sentinel), false);

console.log(
  "Newsroom hosted receipt closure contract PASS: exact Git authority, portable local evidence, provider-bound future receipt hashes, deterministic repeats, timestamped Batch exceptions and secret-free closure.",
);
