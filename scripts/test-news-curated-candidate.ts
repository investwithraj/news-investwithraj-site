import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { getNewsBySlug, NEWS_ARTICLES } from "../content/news";
import type { NewsArticle } from "../content/news/types";
import { ARTICLE_RELATION_RECORDS } from "../lib/article-relations";
import {
  CURATED_NEWS_CANDIDATE_KEYS,
  assertCompletedCuratedPublication,
  assertCuratedPublicationOutcome,
  curatedCandidateMatchesPublishedArticle,
  getCuratedNewsCandidate,
} from "../lib/news-review/curated-candidates";
import {
  approvedPublisherIdentity,
  determineEvidencePolicy,
  selectAutoApproveEligibleDrafts,
} from "../lib/news-review/auto-approve";
import {
  draftContentHash,
  validateDraftArticleShape,
  WITHHELD_MEDIA_APPROVAL_HASH,
} from "../lib/news-review/integrity";
import {
  CURRENT_EVIDENCE_POLICY_VERSION,
  type NewsDraft,
  type NewsDraftProvenance,
  type PublicationReceipt,
} from "../lib/news-review/types";
import { EVIDENCE_CERTIFIED_INDEXABLE_NEWS_ARTICLES } from "../lib/public-content";
import {
  validateDraft,
  type DraftArticle as VoiceDraftArticle,
} from "../lib/voice/validator";

assert.deepEqual(CURATED_NEWS_CANDIDATE_KEYS, [
  "dld-initial-registration-2026-09-07",
  "rak-h1-housing-2026-09-02",
  "adgm-h1-growth-2026-09-08",
  "prestige-one-investment-2026-09-10",
]);

const expectedSources = new Map<string, string[]>([
  ["prestige-one-investment-2026-09-10", ["https://www.wam.ae/en/article/c256iib-dubai-developers-launch-multi-billion-dirham"]],
  [
    "dld-initial-registration-2026-09-07",
    [
      "https://dubailand.gov.ae/en/news-media/dubai-land-department-launches-initial-registration-a-smarter-journey-for-developers-and-greater-efficiency-for-the-real-estate-sector/",
      "https://www.wam.ae/en/article/c227c90-dubai-land-department-launches-ai-powered-initial",
      "https://gulfnews.com/business/property/dubai-land-department-launches-ai-powered-platform-to-speed-up-real-estate-registration-for-developers-1.500662918",
    ],
  ],
  [
    "rak-h1-housing-2026-09-02",
    [
      "https://gulfnews.com/business/property/ras-al-khaimah-property-prices-rise-in-h1-2026-13800-homes-due-by-2028-1.500660431",
      "https://www.khaleejtimes.com/business/ras-al-khaimah-rents-rise-in-h1-2026-but-apartment-rates-drop-in-q2",
    ],
  ],
  [
    "adgm-h1-growth-2026-09-08",
    [
      "https://www.mediaoffice.abudhabi/en/economy/adgm-reinforces-abu-dhabis-position-as-global-financial-hub/",
      "https://gulfnews.com/business/markets/adgm-assets-jump-54-workforce-nears-50000-1.500666929",
    ],
  ],
]);

for (const key of CURATED_NEWS_CANDIDATE_KEYS) {
  const candidate = getCuratedNewsCandidate(key);
  assert.match(candidate.draftId, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu);
  const articleRecord = candidate.article as unknown as Record<string, unknown>;
  assert.equal(Object.hasOwn(articleRecord, "status"), false);
  assert.equal(Object.hasOwn(articleRecord, "publicationContentHash"), false);
  assert.deepEqual(candidate.article.distribution, {});
  assert.deepEqual(
    candidate.article.citations.map((citation) => citation.url),
    expectedSources.get(key),
  );

  const shape = validateDraftArticleShape(candidate.article);
  assert.equal(
    shape.ok,
    true,
    shape.ok ? undefined : `${key}: ${shape.error}`,
  );
  const voice = validateDraft(
    candidate.article as unknown as VoiceDraftArticle,
  );
  assert.equal(
    voice.ok,
    true,
    `${key}: ${voice.failures.map((failure) => failure.name).join(", ")}`,
  );

  for (const citation of candidate.article.citations) {
    const publisher = approvedPublisherIdentity(citation.url);
    assert.ok(publisher, `${citation.url} must have an approved publisher`);
    assert.equal(citation.source, publisher.name);
    assert.equal(citation.tier, publisher.tier);
  }

  // Returned candidates are detached: one execution cannot change the
  // version-controlled candidate used by a later workflow run.
  candidate.article.title = "mutated test copy";
  assert.notEqual(getCuratedNewsCandidate(key).article.title, candidate.article.title);
}

const adgmCandidate = getCuratedNewsCandidate(
  "adgm-h1-growth-2026-09-08",
);
const adgmEvidencePolicy = determineEvidencePolicy(
  adgmCandidate.article,
  adgmCandidate.article.citations.map((citation) => citation.url),
);
assert.equal(
  adgmEvidencePolicy.lane,
  "corroborated-analysis",
  "the ADGM results read must stay on the two-publisher lane",
);
assert.equal(adgmEvidencePolicy.requiredPublisherCount, 2);
assert.deepEqual(adgmCandidate.article.distribution, {});
assert.doesNotMatch(
  adgmCandidate.article.body,
  /(?:office|residential)\s+(?:rent|rents|value|values)\s+(?:rose|fell|increased|decreased)|(?:buy|sell|invest)\s+(?:now|today)/iu,
  "the ADGM institutional results must not invent a real-estate value signal",
);

assert.throws(
  () => getCuratedNewsCandidate("unreviewed-candidate"),
  /Unknown curated news candidate key/u,
);

const publishedCandidate = getCuratedNewsCandidate(
  "dld-initial-registration-2026-09-07",
);
assert.doesNotThrow(() =>
  assertCuratedPublicationOutcome(
    publishedCandidate.key,
    publishedCandidate.article.slug,
    { published: 1, publishedSlugs: [publishedCandidate.article.slug] },
  ),
);
assert.throws(
  () =>
    assertCuratedPublicationOutcome(
      publishedCandidate.key,
      publishedCandidate.article.slug,
      { published: 0, publishedSlugs: [] },
    ),
  /did not publish exactly/u,
  "a held curated target must make its workflow fail",
);
assert.throws(
  () =>
    assertCuratedPublicationOutcome(
      publishedCandidate.key,
      publishedCandidate.article.slug,
      { published: 1, publishedSlugs: ["2026-09-07-unrelated-newer-draft"] },
    ),
  /did not publish exactly/u,
  "a different published slug must make the curated workflow fail",
);

const durableProvenance: NewsDraftProvenance = {
  clusterId: `curated:${publishedCandidate.key}`,
  topic: publishedCandidate.topic,
  score: 100,
  scoreBreakdown: {
    uhnwRelevance: 25,
    sourceTier: 25,
    freshness: 25,
    rajAngle: 25,
  },
  sources: [],
  fetchedEvidence: [],
};
const durableContentHash = draftContentHash(
  publishedCandidate.article,
  durableProvenance,
);
const evidenceApprovalHash = "e".repeat(64);
const claimId = "99999999-9999-4999-8999-999999999999";
const commitSha = "f".repeat(40);
const canonicalUrl =
  `https://news.investwithraj.com/news/${publishedCandidate.article.slug}`;
const publishedArticle: NewsArticle = {
  ...publishedCandidate.article,
  status: "live",
  publicationContentHash: durableContentHash,
  heroImage: {
    ...publishedCandidate.article.heroImage,
    approval: "withheld",
  },
};
const archivedDraft: NewsDraft = {
  id: publishedCandidate.draftId,
  createdAt: "2026-09-07T05:00:00.000Z",
  updatedAt: "2026-09-07T05:10:00.000Z",
  status: "review",
  article: publishedCandidate.article,
  validator: validateDraft(
    publishedCandidate.article as unknown as VoiceDraftArticle,
  ),
  provenance: durableProvenance,
  verifiedSources: publishedCandidate.article.citations.map(
    (citation) => citation.url,
  ),
  revision: 1,
  recordVersion: 4,
  contentHash: durableContentHash,
  evidenceApproval: {
    policyVersion: CURRENT_EVIDENCE_POLICY_VERSION,
    hash: evidenceApprovalHash,
    revision: 1,
    contentHash: durableContentHash,
    sourceUrls: publishedCandidate.article.citations.map(
      (citation) => citation.url,
    ),
    evidenceHashes: [],
    reviewer: "deterministic-auto-publisher",
    approvedAt: "2026-09-07T05:02:00.000Z",
  },
  publication: {
    state: "completed",
    evidencePolicyVersion: CURRENT_EVIDENCE_POLICY_VERSION,
    claimId,
    revision: 1,
    contentHash: durableContentHash,
    mediaApprovalHash: WITHHELD_MEDIA_APPROVAL_HASH,
    evidenceApprovalHash,
    startedAt: "2026-09-07T05:03:00.000Z",
    updatedAt: "2026-09-07T05:10:00.000Z",
    commitSha,
    url: canonicalUrl,
  },
};
const durableReceipt: PublicationReceipt = {
  draftId: publishedCandidate.draftId,
  evidencePolicyVersion: CURRENT_EVIDENCE_POLICY_VERSION,
  claimId,
  slug: publishedCandidate.article.slug,
  revision: 1,
  contentHash: durableContentHash,
  mediaApprovalHash: WITHHELD_MEDIA_APPROVAL_HASH,
  evidenceApprovalHash,
  commitSha,
  url: canonicalUrl,
  completedAt: "2026-09-07T05:10:00.000Z",
  expiresAt: "2026-10-07T05:10:00.000Z",
};
assert.equal(
  curatedCandidateMatchesPublishedArticle(
    publishedCandidate,
    publishedArticle,
  ),
  true,
  "an exact published candidate must become a no-op despite pipeline-owned fields",
);
assert.equal(
  curatedCandidateMatchesPublishedArticle(publishedCandidate, {
    ...publishedArticle,
    title: `${publishedArticle.title} changed`,
  }),
  false,
  "an editorially different public article must not be treated as the candidate",
);
assert.equal(
  curatedCandidateMatchesPublishedArticle(publishedCandidate, {
    ...publishedArticle,
    heroImage: {
      ...publishedArticle.heroImage,
      alt: `${publishedArticle.heroImage.alt} changed`,
    },
  }),
  false,
  "reader-visible media alt text remains part of the editorial identity",
);
assert.doesNotThrow(() =>
  assertCompletedCuratedPublication({
    candidate: publishedCandidate,
    published: publishedArticle,
    archivedDraft,
    receipt: durableReceipt,
    currentEvidenceFingerprint: "d".repeat(64),
    archivedEvidenceFingerprint: "d".repeat(64),
    canonicalDeploymentVerified: true,
  }),
);
assert.throws(
  () =>
    assertCompletedCuratedPublication({
      candidate: publishedCandidate,
      published: publishedArticle,
      archivedDraft,
      receipt: { ...durableReceipt, contentHash: "a".repeat(64) },
      currentEvidenceFingerprint: "d".repeat(64),
      archivedEvidenceFingerprint: "d".repeat(64),
      canonicalDeploymentVerified: true,
    }),
  /lacks an exact durable publication proof/u,
  "a repository article without an exact receipt must never become a no-op",
);
assert.throws(
  () =>
    assertCompletedCuratedPublication({
      candidate: publishedCandidate,
      published: publishedArticle,
      archivedDraft,
      receipt: durableReceipt,
      currentEvidenceFingerprint: "d".repeat(64),
      archivedEvidenceFingerprint: "c".repeat(64),
      canonicalDeploymentVerified: true,
    }),
  /lacks an exact durable publication proof/u,
  "changed fetched evidence must prevent an already-published no-op",
);
assert.throws(
  () =>
    assertCompletedCuratedPublication({
      candidate: publishedCandidate,
      published: publishedArticle,
      archivedDraft,
      receipt: durableReceipt,
      currentEvidenceFingerprint: "d".repeat(64),
      archivedEvidenceFingerprint: "d".repeat(64),
      canonicalDeploymentVerified: false,
    }),
  /lacks an exact durable publication proof/u,
  "an undeployed commit must never become a green no-op",
);

const targetId = "11111111-1111-4111-8111-111111111111";
const targetHash = "b".repeat(64);
const minimalDraft = (
  id: string,
  contentHash: string,
  publishedAt: string,
): NewsDraft =>
  ({
    id,
    contentHash,
    article: { publishedAt },
    provenance: { score: 0 },
  }) as unknown as NewsDraft;
const targetDraft = minimalDraft(
  targetId,
  targetHash,
  "2026-09-07T04:50:00.000Z",
);
const unrelatedNewerDraft = minimalDraft(
  "22222222-2222-4222-8222-222222222222",
  "c".repeat(64),
  "2026-09-07T05:50:00.000Z",
);
assert.deepEqual(
  selectAutoApproveEligibleDrafts([unrelatedNewerDraft, targetDraft], {
    target: { id: targetId, contentHash: targetHash },
  }).map((draft) => draft.id),
  [targetId],
  "a newer unrelated draft must never displace the exact curated target",
);
assert.throws(
  () =>
    selectAutoApproveEligibleDrafts([unrelatedNewerDraft, targetDraft], {
      target: { id: targetId, contentHash: "d".repeat(64) },
    }),
  /content hash no longer matches/u,
);
assert.throws(
  () =>
    selectAutoApproveEligibleDrafts([unrelatedNewerDraft], {
      target: { id: targetId, contentHash: targetHash },
    }),
  /absent or no longer active/u,
  "an already-published or otherwise absent target must fail instead of falling through",
);

const workflow = readFileSync(
  new URL("../.github/workflows/news-cron.yml", import.meta.url),
  "utf8",
);
assert.match(workflow, /cron: "37 1 \* \* \*"/u);
assert.match(workflow, /cron: "17 5 \* \* \*"/u);
assert.match(workflow, /candidate_key:/u);
assert.match(workflow, /- dld-initial-registration/u);
assert.match(workflow, /curated_candidate_key:/u);
for (const key of CURATED_NEWS_CANDIDATE_KEYS) {
  assert.match(workflow, new RegExp(`- ${key}`, "u"));
}
assert.match(workflow, /Stage selected curated candidate/u);
assert.match(workflow, /scripts\/stage-curated-candidate\.ts/u);
assert.match(workflow, /CURATED_CANDIDATE_KEY:/u);
assert.match(
  workflow,
  /AUTO_APPROVE:.*curated_candidate_key != 'none'.*'1'/u,
);
assert.match(
  workflow,
  /DRAFT_ENABLED:.*publication_only \|\| inputs\.curated_candidate_key != 'none'.*'0'/u,
);
assert.match(workflow, /AUTO_PUBLISH_LIMIT: "1"/u);
assert.match(
  workflow,
  /AUTO_APPROVE_TARGET_DRAFT_ID: \$\{\{ steps\.curated\.outputs\.draft_id \}\}/u,
);
assert.match(
  workflow,
  /AUTO_APPROVE_TARGET_CONTENT_HASH: \$\{\{ steps\.curated\.outputs\.content_hash \}\}/u,
);
assert.match(
  workflow,
  /AUTO_APPROVE_TARGET_SLUG: \$\{\{ steps\.curated\.outputs\.slug \}\}/u,
);
assert.match(workflow, /steps\.curated\.outputs\.already_published != '1'/u);
assert.match(workflow, /Surface curated no-op/u);

const stageScript = readFileSync(
  new URL("./stage-curated-candidate.ts", import.meta.url),
  "utf8",
);
assert.match(stageScript, /process\.env\.POST_PUBLISH_SECRET/u);
assert.match(
  stageScript,
  /const PROTECTED_SITE_ORIGIN = "https:\/\/news\.investwithraj\.com"/u,
);
assert.match(
  stageScript,
  /process\.env\.SITE_URL !== PROTECTED_SITE_ORIGIN/u,
  "a caller cannot redirect the secret-bearing API target with SITE_URL",
);
assert.doesNotMatch(stageScript, /fetch\(`\$\{SITE_URL\}/u);
assert.match(stageScript, /redirect: "error"/u);
assert.match(stageScript, /assertExactResponseLocation/u);
assert.match(stageScript, /parseBoundedJsonResponse/u);
assert.match(stageScript, /readBoundedResponseText/u);
assert.doesNotMatch(stageScript, /response\.text\(\)/u);
assert.doesNotMatch(
  stageScript,
  /payload\.error/u,
  "remote error strings must not be copied into automation logs",
);
assert.match(stageScript, /fetchArticleText\(citation\.url/u);
assert.match(stageScript, /approvedEvidencePublisherDomain/u);
assert.match(stageScript, /CURATED_PREFLIGHT_ONLY/u);
assert.match(stageScript, /curated candidate already published/u);
assert.match(stageScript, /assertCompletedCuratedPublication/u);
assert.match(stageScript, /verifyCanonicalDeployment/u);
assert.match(stageScript, /\/receipt/u);
assert.match(stageScript, /publication\?\.state === "committed"/u);
assert.match(stageScript, /recoverCommittedCandidate/u);
assert.match(stageScript, /verifyDurableProof/u);
assert.match(stageScript, /draftId: candidate\.draftId/u);
assert.match(
  stageScript,
  /`\/api\/news\/draft\?id=\$\{encodeURIComponent\(id\)\}`/u,
  "curated staging must request only its deterministic draft record",
);
assert.doesNotMatch(stageScript, /DraftListPayload/u);
assert.doesNotMatch(stageScript, /async function readDrafts/u);
assert.doesNotMatch(stageScript, /\/api\/news\/draft\/[^"`]+\/publish/u);
assert.ok(
  stageScript.indexOf('publication?.state === "committed"') <
    stageScript.indexOf("const reservationToken = await reserveCluster(candidate)"),
  "a committed exact draft must enter recovery before any staging mutation",
);
assert.ok(
  stageScript.indexOf("const assessment = assessDraft") <
    stageScript.indexOf("const reservationToken = await reserveCluster(candidate)"),
  "deterministic assessment must happen before the first mutation",
);
assert.ok(
  stageScript.indexOf("if (PREFLIGHT_ONLY)") <
    stageScript.indexOf("const published = getNewsBySlug"),
  "preflight mode must exit before any protected API read",
);
assert.ok(
  stageScript.indexOf("assertCompletedCuratedPublication({") <
    stageScript.indexOf('emitActionOutput("already_published", "1")'),
  "a checked-out article alone must never produce an already-published no-op",
);

const draftOnceScript = readFileSync(
  new URL("./draft-once.ts", import.meta.url),
  "utf8",
);
assert.match(draftOnceScript, /assertCuratedPublicationOutcome/u);
assert.match(draftOnceScript, /targetDraftId/u);
assert.match(draftOnceScript, /targetContentHash/u);
assert.match(
  draftOnceScript,
  /assertCuratedPublicationOutcome\([\s\S]*?summary,[\s\S]*?\)/u,
);

const storageScript = readFileSync(
  new URL("../lib/news-review/storage.ts", import.meta.url),
  "utf8",
);
assert.match(storageScript, /publicationArchiveKey\(draft\.id\)/u);
assert.match(storageScript, /publicationReceiptKey\(draft\.id\)/u);
assert.match(storageScript, /item\.id === draft\.id/u);

const draftRoute = readFileSync(
  new URL("../app/api/news/draft/route.ts", import.meta.url),
  "utf8",
);
assert.match(draftRoute, /requestedIds = req\.nextUrl\.searchParams\.getAll\("id"\)/u);
assert.match(draftRoute, /auth\.credential !== "server-secret"/u);
assert.match(draftRoute, /getStoredDraft\(requestedIds\[0\]\)/u);
assert.match(draftRoute, /DETERMINISTIC_DRAFT_ID\.test\(requestedIds\[0\]\)/u);

const receiptRoute = readFileSync(
  new URL("../app/api/news/draft/[id]/receipt/route.ts", import.meta.url),
  "utf8",
);
assert.match(receiptRoute, /auth\.credential !== "server-secret"/u);
assert.match(receiptRoute, /getPublicationReceipt\(id\)/u);
assert.match(receiptRoute, /getArchivedPublicationDraft\(id\)/u);

const packageJson = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
) as { scripts?: Record<string, string> };
assert.equal(
  packageJson.scripts?.["news:stage-curated"],
  "tsx scripts/stage-curated-candidate.ts",
);
assert.equal(
  packageJson.scripts?.["test:news-curated-candidate"],
  "tsx scripts/test-news-curated-candidate.ts",
);

for (const key of CURATED_NEWS_CANDIDATE_KEYS) {
  const candidate = getCuratedNewsCandidate(key);
  const moduleUrl = new URL(
    `../content/news/${candidate.article.slug}.ts`,
    import.meta.url,
  );
  const publicArticle = getNewsBySlug(candidate.article.slug);
  const registeredArticles = NEWS_ARTICLES.filter(
    (article) => article.slug === candidate.article.slug,
  );
  const relationRecords = ARTICLE_RELATION_RECORDS.filter(
    (record) => record.articleSlug === candidate.article.slug,
  );

  if (!existsSync(moduleUrl)) {
    assert.equal(
      publicArticle,
      null,
      `${key} is unpublished and must not enter the public article registry`,
    );
    assert.equal(registeredArticles.length, 0);
    assert.equal(
      relationRecords.length,
      0,
      `${key} is unpublished and must not receive a public relation record`,
    );
    continue;
  }

  assert.ok(
    publicArticle,
    `${key} has a public module but is missing from the article registry`,
  );
  assert.equal(
    curatedCandidateMatchesPublishedArticle(candidate, publicArticle),
    true,
    `${key} public editorial fields differ from the reviewed candidate`,
  );
  assert.equal(publicArticle.status, "live");
  assert.match(
    publicArticle.publicationContentHash ?? "",
    /^[a-f0-9]{64}$/u,
    `${key} must carry its immutable publication content hash`,
  );
  assert.equal(
    EVIDENCE_CERTIFIED_INDEXABLE_NEWS_ARTICLES.some(
      (article) =>
        article.slug === candidate.article.slug &&
        article.publicationContentHash === publicArticle.publicationContentHash,
    ),
    true,
    `${key} must cross the current-policy evidence-certified public boundary`,
  );
  assert.equal(
    registeredArticles.length,
    1,
    `${key} must have exactly one public article registry entry`,
  );
  assert.equal(
    relationRecords.length,
    1,
    `${key} must have exactly one explicit public relation record`,
  );

  const moduleSource = readFileSync(moduleUrl, "utf8");
  assert.match(moduleSource, /Auto-generated by the editorial publication pipeline/u);
  assert.match(moduleSource, /"status": "live"/u);
  assert.match(
    moduleSource,
    new RegExp(
      `"publicationContentHash": "${publicArticle.publicationContentHash}"`,
      "u",
    ),
  );
}

console.log(
  "Curated news candidate regression passed: reviewed drafts remain private, allowlisted, distribution-free and workflow-gated.",
);
