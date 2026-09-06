import assert from "node:assert/strict";

import { planDraftCandidates } from "../lib/news-review/draft-engine.js";
import type { NewsDraft } from "../lib/news-review/types.js";
import type { Cluster } from "../lib/pipeline/types.js";

const CLUSTER_ID = "palm-jebel-ali-official-update";

function cluster(): Cluster {
  return {
    id: CLUSTER_ID,
    topic: "Palm Jebel Ali official update",
    entries: [],
    score: 88,
    scoreBreakdown: {
      uhnwRelevance: 24,
      sourceTier: 24,
      freshness: 20,
      rajAngle: 20,
    },
    entities: {
      developers: ["Nakheel"],
      places: ["Palm Jebel Ali"],
      figures: [],
      hasTier1Source: true,
    },
    suggestedCategory: "launch",
    suggestedMarkets: ["Dubai"],
  };
}

function heldDraft(overrides: Partial<NewsDraft> = {}): NewsDraft {
  return {
    id: "held-draft-1",
    createdAt: "2026-09-03T06:00:00.000Z",
    updatedAt: "2026-09-04T06:00:00.000Z",
    status: "review",
    revision: 1,
    recordVersion: 1,
    contentHash: "a".repeat(64),
    article: {
      slug: "2026-09-03-palm-jebel-ali-official-update",
      title: "Palm Jebel Ali official update",
      subtitle: "Nakheel announced an official Palm Jebel Ali update.",
      publishedAt: "2026-09-03T06:00:00.000Z",
      modifiedAt: "2026-09-03T06:00:00.000Z",
      displayDate: "03 Sep 2026",
      author: "raj-tomar",
      tier: "news",
      category: "launch",
      market: ["Dubai"],
      tldr: ["Held", "Held", "Held"],
      body: "Nakheel announced an official update.",
      faq: [],
      citations: [],
      heroImage: {
        src: "/news/2026-09-03-palm-jebel-ali-official-update/cover.jpg",
        alt: "Palm Jebel Ali",
        credit: "Held",
      },
      cta: { href: "/brief", label: "Brief" },
      distribution: {},
    },
    validator: {
      ok: false,
      failures: [
        { gate: 7, name: "word-count", severity: "block", detail: "too short" },
      ],
      metrics: { citationCount: 0, citationsFromWhitelist: 0 },
    },
    provenance: {
      clusterId: CLUSTER_ID,
      topic: "Palm Jebel Ali official update",
      score: 88,
      scoreBreakdown: {
        uhnwRelevance: 24,
        sourceTier: 24,
        freshness: 20,
        rajAngle: 20,
      },
      sources: [],
      fetchedEvidence: [],
    },
    ...overrides,
  } as NewsDraft;
}

function main(): void {
  const original = heldDraft();
  const before = JSON.stringify(original);
  const recovery = planDraftCandidates({
    clusters: [cluster()],
    drafts: [original],
    now: new Date("2026-09-06T08:00:00.000Z"),
    minRecoveryAgeHours: 24,
  });
  assert.equal(recovery.recoverableHeld, 1);
  assert.equal(recovery.candidates.length, 1);
  assert.equal(
    recovery.candidates[0]?.id,
    `${CLUSTER_ID}:recovery:2026-09-06`,
  );
  assert.equal(
    recovery.recoveryDraftIds[recovery.candidates[0]!.id],
    original.id,
  );
  assert.equal(
    JSON.stringify(original),
    before,
    "recovery planning must preserve the held user-visible record",
  );

  const sameDay = heldDraft({
    id: "same-day-held",
    createdAt: "2026-09-06T00:10:00.000Z",
    updatedAt: "2026-09-06T00:10:00.000Z",
    article: {
      ...original.article,
      slug: "2026-09-06-palm-jebel-ali-official-update",
      publishedAt: "2026-09-06T00:10:00.000Z",
      modifiedAt: "2026-09-06T00:10:00.000Z",
    },
  });
  const sameDayPlan = planDraftCandidates({
    clusters: [cluster()],
    drafts: [sameDay],
    now: new Date("2026-09-06T18:00:00.000Z"),
    minRecoveryAgeHours: 1,
  });
  assert.equal(sameDayPlan.recoverableHeld, 0);
  assert.equal(
    sameDayPlan.candidates.length,
    0,
    "same-day held content must not churn or collide with its canonical slug",
  );

  const existingRecovery = heldDraft({
    id: "recovery-already-staged",
    provenance: {
      ...original.provenance,
      clusterId: `${CLUSTER_ID}:recovery:2026-09-06`,
    },
  });
  const duplicatePlan = planDraftCandidates({
    clusters: [cluster()],
    drafts: [original, existingRecovery],
    now: new Date("2026-09-06T08:00:00.000Z"),
  });
  assert.equal(
    duplicatePlan.candidates.length,
    0,
    "a date-scoped recovery reservation must make reruns idempotent",
  );

  const recentRecovery = heldDraft({
    id: "recent-recovery",
    createdAt: "2026-09-05T20:00:00.000Z",
    updatedAt: "2026-09-05T20:00:00.000Z",
    article: {
      ...original.article,
      slug: "2026-09-06-palm-jebel-ali-recovery",
      publishedAt: "2026-09-05T20:00:00.000Z",
      modifiedAt: "2026-09-05T20:00:00.000Z",
    },
    provenance: {
      ...original.provenance,
      clusterId: `${CLUSTER_ID}:recovery:2026-09-06`,
    },
  });
  const rapidRetryPlan = planDraftCandidates({
    clusters: [cluster()],
    drafts: [original, recentRecovery],
    now: new Date("2026-09-06T08:00:00.000Z"),
  });
  assert.equal(rapidRetryPlan.recoverableHeld, 0);
  assert.equal(
    rapidRetryPlan.candidates.length,
    0,
    "a newer recovery attempt must reset the bounded retry age",
  );

  console.log(
    "Held-draft recovery regression passed: old records are preserved, redrafts are bounded and same-day reruns are idempotent.",
  );
}

main();
