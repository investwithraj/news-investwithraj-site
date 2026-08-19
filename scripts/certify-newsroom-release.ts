import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { NextRequest } from "next/server";

import sitemap from "../app/sitemap";
import nextConfig from "../next.config";
import { proxy } from "../proxy";
import {
  NEWSROOM_EXACT_REDIRECTS,
  NEWSROOM_HELD_REDIRECTS,
  NEWSROOM_LIFECYCLE_CUTOVER_ENV,
  NEWSROOM_RELEASE_REMOVAL_CANDIDATES,
  PRIMARY_NEWSROOM_LIFECYCLE,
  getReleasedNewsroomRedirects,
  isNewsroomLifecycleCutoverEnabled,
} from "../lib/news-lifecycle";
import {
  INDEXABLE_NEWS_ARTICLES,
  getPublicDiscoveryNewsArticles,
} from "../lib/public-content";
import { CURRENT_EVIDENCE_POLICY_VERSION } from "../lib/news-review/types";

const ROOT = process.cwd();
const AUTHORITY_PATH = "docs/migration/news-url-disposition.csv";

type Redirect = Readonly<{
  source: string;
  destination: string;
  permanent?: boolean;
  statusCode?: number;
}>;

type CsvRow = Readonly<Record<string, string>>;

function source(path: string): string {
  return readFileSync(resolve(ROOT, path), "utf8");
}

function parseCsv(input: string): CsvRow[] {
  const records: string[][] = [];
  let record: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (quoted) {
      if (character === '"' && input[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
      continue;
    }
    if (character === '"') {
      quoted = true;
    } else if (character === ",") {
      record.push(field);
      field = "";
    } else if (character === "\n") {
      record.push(field.replace(/\r$/u, ""));
      records.push(record);
      record = [];
      field = "";
    } else {
      field += character;
    }
  }
  if (field || record.length > 0) {
    record.push(field.replace(/\r$/u, ""));
    records.push(record);
  }

  const [headers, ...rows] = records.filter((row) => row.some(Boolean));
  assert.ok(headers, "The lifecycle authority needs a CSV header.");
  return rows.map((row) =>
    Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""])),
  );
}

function sitemapPaths(): string[] {
  return sitemap()
    .map((entry) => new URL(entry.url).pathname)
    .sort();
}

function articleSlugs(): string[] {
  return getPublicDiscoveryNewsArticles()
    .map((article) => article.slug)
    .sort();
}

async function configuredRedirects(): Promise<Redirect[]> {
  if (typeof nextConfig.redirects !== "function") {
    throw new Error("next.config.ts has no redirects function.");
  }
  return (await nextConfig.redirects()) as Redirect[];
}

function withCutover<T>(enabled: boolean, action: () => T): T {
  const original = process.env[NEWSROOM_LIFECYCLE_CUTOVER_ENV];
  try {
    if (enabled) {
      process.env[NEWSROOM_LIFECYCLE_CUTOVER_ENV] = "1";
    } else {
      delete process.env[NEWSROOM_LIFECYCLE_CUTOVER_ENV];
    }
    return action();
  } finally {
    if (original === undefined) {
      delete process.env[NEWSROOM_LIFECYCLE_CUTOVER_ENV];
    } else {
      process.env[NEWSROOM_LIFECYCLE_CUTOVER_ENV] = original;
    }
  }
}

async function redirectsWithCutover(enabled: boolean): Promise<Redirect[]> {
  const original = process.env[NEWSROOM_LIFECYCLE_CUTOVER_ENV];
  try {
    if (enabled) {
      process.env[NEWSROOM_LIFECYCLE_CUTOVER_ENV] = "1";
    } else {
      delete process.env[NEWSROOM_LIFECYCLE_CUTOVER_ENV];
    }
    return await configuredRedirects();
  } finally {
    if (original === undefined) {
      delete process.env[NEWSROOM_LIFECYCLE_CUTOVER_ENV];
    } else {
      process.env[NEWSROOM_LIFECYCLE_CUTOVER_ENV] = original;
    }
  }
}

async function main(): Promise<void> {
  const originalCutover = process.env[NEWSROOM_LIFECYCLE_CUTOVER_ENV];
  const authority = source(AUTHORITY_PATH);
  const rows = parseCsv(authority);
  const primaryRows = rows.filter((row) => row.in_sitemap === "yes");

  assert.equal(rows.length, 130, "The authoritative lifecycle row count changed.");
  assert.equal(primaryRows.length, 79, "The primary lifecycle baseline changed.");
  assert.equal(Object.keys(PRIMARY_NEWSROOM_LIFECYCLE).length, 79);
  assert.equal(isNewsroomLifecycleCutoverEnabled({}), false);
  assert.equal(
    isNewsroomLifecycleCutoverEnabled({ [NEWSROOM_LIFECYCLE_CUTOVER_ENV]: "1" }),
    true,
  );
  for (const disabledValue of ["", "0", "true", " 1 ", "on"]) {
    assert.equal(
      isNewsroomLifecycleCutoverEnabled({
        [NEWSROOM_LIFECYCLE_CUTOVER_ENV]: disabledValue,
      }),
      false,
      `The lifecycle switch accepted ${JSON.stringify(disabledValue)}.`,
    );
  }

  const cutoverOff = withCutover(false, () => ({
    sitemapPaths: sitemapPaths(),
    publicArticleSlugs: articleSlugs(),
    lifecycleRedirects: getReleasedNewsroomRedirects(),
  }));
  const cutoverOn = withCutover(true, () => ({
    sitemapPaths: sitemapPaths(),
    publicArticleSlugs: articleSlugs(),
    lifecycleRedirects: getReleasedNewsroomRedirects().map((redirect) => ({
      source: redirect.source,
      destination: redirect.destination,
      statusCode: redirect.statusCode,
    })).sort((left, right) =>
      left.source < right.source ? -1 : left.source > right.source ? 1 : 0,
    ),
  }));
  const configuredOff = await redirectsWithCutover(false);
  const configuredOn = await redirectsWithCutover(true);

  assert.equal(cutoverOff.sitemapPaths.length, 79);
  assert.equal(cutoverOff.publicArticleSlugs.length, 41);
  assert.equal(cutoverOff.lifecycleRedirects.length, 0);
  assert.equal(cutoverOn.sitemapPaths.length, 31);
  assert.equal(cutoverOn.publicArticleSlugs.length, 26);
  assert.equal(cutoverOn.lifecycleRedirects.length, 31);
  assert.equal(NEWSROOM_EXACT_REDIRECTS.length, 31);
  assert.equal(NEWSROOM_RELEASE_REMOVAL_CANDIDATES.length, 6);
  assert.equal(Object.keys(NEWSROOM_HELD_REDIRECTS).length, 3);
  assert.equal(
    configuredOff.filter((redirect) =>
      NEWSROOM_EXACT_REDIRECTS.some((candidate) => candidate.source === redirect.source),
    ).length,
    0,
  );
  assert.equal(
    configuredOn.filter((redirect) =>
      NEWSROOM_EXACT_REDIRECTS.some((candidate) => candidate.source === redirect.source),
    ).length,
    31,
  );

  const missingContentHashSlugs = INDEXABLE_NEWS_ARTICLES.filter(
    (article) => !article.publicationContentHash,
  )
    .map((article) => article.slug)
    .sort();
  const oneSourceSlugs = INDEXABLE_NEWS_ARTICLES.filter(
    (article) => article.citations.length === 1,
  )
    .map((article) => article.slug)
    .sort();
  assert.equal(INDEXABLE_NEWS_ARTICLES.length, 26);
  assert.equal(missingContentHashSlugs.length, 24);
  assert.equal(oneSourceSlugs.length, 7);

  const launch = source("LAUNCH.md");
  const runbook = source("RUNBOOK.md");
  const backendMap = source("docs/BACKEND-MAP.md");
  const workflow = source(".github/workflows/news-cron.yml");
  const publishRoute = source("app/api/news/draft/[id]/publish/route.ts");
  const lifecycleRelease = source("docs/migration/newsroom-lifecycle-release.md");
  for (const document of [launch, runbook, backendMap]) {
    assert.match(document, /NEWSROOM_LIFECYCLE_CUTOVER=1/u);
    assert.match(document, /evidence policy v3/iu);
    assert.match(document, /server credential/iu);
    assert.match(document, /24[\s\S]{0,80}?content hash/iu);
    assert.match(document, /7[\s\S]{0,80}?one-source/iu);
    assert.match(document, /six[\s\S]{0,120}?410/iu);
  }
  assert.doesNotMatch(
    `${launch}\n${backendMap}`,
    /server credential can stage content, but it cannot publish|There is no automatic-publish branch/iu,
  );
  assert.match(workflow, /AUTO_APPROVE:\s*"1"/u);
  assert.match(workflow, /AUTO_PUBLISH_LIMIT:\s*"1"/u);
  assert.match(publishRoute, /const automated = auth\.credential === "server-secret"/u);
  assert.match(lifecycleRelease, /direct 410[\s\S]{0,20}?Gone response/iu);

  process.env[NEWSROOM_LIFECYCLE_CUTOVER_ENV] = "1";
  try {
    for (const pathname of NEWSROOM_RELEASE_REMOVAL_CANDIDATES) {
      const response = await proxy(
        new NextRequest(`https://news.investwithraj.com${pathname}`),
      );
      assert.equal(response.status, 410);
      assert.equal(response.headers.get("location"), null);
      assert.equal(
        response.headers.get("x-robots-tag"),
        "noindex, nofollow, noarchive",
      );
    }
  } finally {
    if (originalCutover === undefined) {
      delete process.env[NEWSROOM_LIFECYCLE_CUTOVER_ENV];
    } else {
      process.env[NEWSROOM_LIFECYCLE_CUTOVER_ENV] = originalCutover;
    }
  }

  const heldRedirects = Object.entries(NEWSROOM_HELD_REDIRECTS)
    .map(([sourcePath, hold]) => ({ source: sourcePath, ...hold }))
    .sort((left, right) =>
      left.source < right.source ? -1 : left.source > right.source ? 1 : 0,
    );
  const mediumConfidenceRemovalCandidates = [
    "/news/2026-06-29-dar-global-launches-19-fendi-casa-villas-at-oman-s-aida-clif",
    "/news/2026-07-12-kuwait-property-deals-fall-13-as-land-fees-and-war-chill-h1-",
  ] as const;
  assert.ok(
    mediumConfidenceRemovalCandidates.every((pathname) =>
      NEWSROOM_RELEASE_REMOVAL_CANDIDATES.includes(pathname),
    ),
  );
  const releaseBlockers = [
    {
      code: "HELD_REDIRECTS",
      count: heldRedirects.length,
      releaseRule: "Do not activate these redirects until their recorded hold is resolved.",
    },
    {
      code: "LEGACY_CONTENT_HASH",
      count: missingContentHashSlugs.length,
      releaseRule:
        "These matrix-retained articles are not evidence-policy-v3 certified; keep the debt explicit and re-review before claiming full evidence migration.",
    },
    {
      code: "LEGACY_ONE_SOURCE",
      count: oneSourceSlugs.length,
      releaseRule:
        "These legacy articles require source repair or an explicit noindex decision before claiming universal two-publisher coverage.",
    },
    {
      code: "REMOVAL_DEMAND_CHECKS",
      count: NEWSROOM_RELEASE_REMOVAL_CANDIDATES.length,
      candidates: [...NEWSROOM_RELEASE_REMOVAL_CANDIDATES].sort(),
      mediumConfidenceCandidates: [...mediumConfidenceRemovalCandidates].sort(),
      releaseRule:
        "Do not activate the six 410 responses until Search Console, backlink/referral, analytics and access-log demand checks are attached; Kuwait and Fendi remain medium-confidence removals.",
    },
  ] as const;

  const manifest = {
    schemaVersion: "newsroom-offline-release-certification-v2",
    status: "offline-contract-valid-live-release-blocked",
    runtimeBehaviorChanged: true,
    authority: {
      path: AUTHORITY_PATH,
      sha256: createHash("sha256").update(authority).digest("hex"),
      rows: rows.length,
      primaryRows: primaryRows.length,
    },
    releaseSwitch: {
      environment: NEWSROOM_LIFECYCLE_CUTOVER_ENV,
      enabledValue: "1",
      defaultState: "off",
      evaluation: "build/release-time",
    },
    evidencePolicy: {
      version: CURRENT_EVIDENCE_POLICY_VERSION,
      automatedPublication:
        "server-secret permitted only after the deterministic evidence policy passes",
      liveReleaseClaim: "blocked until external infrastructure and deployment are separately proven",
    },
    cutoverOff: {
      sitemapCount: cutoverOff.sitemapPaths.length,
      sitemapPaths: cutoverOff.sitemapPaths,
      publicArticleCount: cutoverOff.publicArticleSlugs.length,
      publicArticleSlugs: cutoverOff.publicArticleSlugs,
      lifecycleRedirectCount: cutoverOff.lifecycleRedirects.length,
    },
    cutoverOn: {
      sitemapCount: cutoverOn.sitemapPaths.length,
      sitemapPaths: cutoverOn.sitemapPaths,
      publicArticleCount: cutoverOn.publicArticleSlugs.length,
      publicArticleSlugs: cutoverOn.publicArticleSlugs,
      lifecycleRedirectCount: cutoverOn.lifecycleRedirects.length,
      lifecycleRedirects: cutoverOn.lifecycleRedirects,
      removalResponse: {
        status: 410,
        candidates: [...NEWSROOM_RELEASE_REMOVAL_CANDIDATES].sort(),
        implementation: "exact-path proxy response",
        defaultState: "unchanged while cutover is off",
      },
    },
    heldRedirects,
    legacyEvidence: {
      indexCandidateCount: INDEXABLE_NEWS_ARTICLES.length,
      policyV3ContentHashCount:
        INDEXABLE_NEWS_ARTICLES.length - missingContentHashSlugs.length,
      missingContentHashCount: missingContentHashSlugs.length,
      missingContentHashSlugs,
      oneSourceCount: oneSourceSlugs.length,
      oneSourceSlugs,
      certification:
        "legacy matrix retention only; not evidence-policy-v3 certification",
    },
    blockers: releaseBlockers,
    excludedProof:
      "This offline certificate does not prove KV, secrets, GitHub, DNS, cron, build, deployment, indexing, Search Console, backlinks/referrals, analytics, access logs or provider connectivity.",
  } as const;

  assert.equal(manifest.evidencePolicy.version, 3);
  assert.equal(manifest.status, "offline-contract-valid-live-release-blocked");
  assert.equal(originalCutover, process.env[NEWSROOM_LIFECYCLE_CUTOVER_ENV]);

  console.log(JSON.stringify(manifest, null, 2));
  console.error(
    `Offline newsroom contract valid; live release remains blocked by ${heldRedirects.length} held redirects, ${missingContentHashSlugs.length} missing content hashes, ${oneSourceSlugs.length} one-source legacy records and ${NEWSROOM_RELEASE_REMOVAL_CANDIDATES.length} removal demand checks.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
