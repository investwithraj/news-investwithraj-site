import assert from "node:assert/strict";

import { planDraftCandidates } from "../lib/news-review/draft-engine.js";
import {
  findNewsClusterQuarantine,
  NEWS_CLUSTER_QUARANTINE,
} from "../lib/news-review/candidate-quarantine.js";
import type { Cluster } from "../lib/pipeline/types.js";

const gatewayRule = NEWS_CLUSTER_QUARANTINE[0];

function cluster(overrides: Partial<Cluster> = {}): Cluster {
  return {
    id: "policy",
    topic: gatewayRule.topic,
    entries: [
      {
        id: "gateway-2040-zawya",
        title: gatewayRule.topic,
        url: "https://news.google.com/rss/articles/gateway-2040?oc=5",
        publishedAt: gatewayRule.provenance.sourcePublishedAt,
        summary: "Gateway 2040 promotional event listing.",
        source: {
          name: "Zawya",
          tier: "national-press",
          domain: gatewayRule.provenance.sourceDomain,
        },
      },
    ],
    score: 53,
    scoreBreakdown: {
      uhnwRelevance: 30,
      sourceTier: 70,
      freshness: 50,
      rajAngle: 24,
    },
    entities: {
      developers: [],
      places: [],
      figures: [],
      hasTier1Source: false,
    },
    suggestedCategory: "policy",
    suggestedMarkets: ["UAE"],
    ...overrides,
  };
}

function main(): void {
  const exactGateway = cluster();
  const hold = findNewsClusterQuarantine(exactGateway);
  assert.equal(hold?.ruleId, gatewayRule.id);
  assert.match(hold?.reason ?? "", /Permanent editorial hold/u);

  const safePolicy = cluster({
    topic: "Dubai updates a real-estate residency process",
    entries: [],
  });
  assert.equal(
    findNewsClusterQuarantine(safePolicy),
    null,
    "the shared policy bucket must remain available for unrelated stories",
  );

  const unrelatedProvenance = cluster({
    entries: [
      {
        ...exactGateway.entries[0]!,
        source: {
          ...exactGateway.entries[0]!.source,
          domain: "example.test",
        },
      },
    ],
  });
  assert.equal(
    findNewsClusterQuarantine(unrelatedProvenance),
    null,
    "an exact topic is held only with the reviewed publisher provenance",
  );

  const plan = planDraftCandidates({
    clusters: [exactGateway, safePolicy],
    drafts: [],
    now: new Date("2026-09-07T08:00:00.000Z"),
  });
  assert.deepEqual(
    plan.candidates.map((candidate) => candidate.topic),
    [safePolicy.topic],
    "the exact Gateway story must never reach reservation or paid research",
  );
  assert.equal(plan.quarantined.length, 1);
  assert.equal(plan.quarantined[0]?.clusterId, "policy");
  assert.equal(plan.quarantined[0]?.reason, gatewayRule.reason);

  const reorderedPolicyCluster = cluster({
    topic: "Dubai updates a real-estate residency process",
  });
  assert.equal(
    findNewsClusterQuarantine(reorderedPolicyCluster)?.ruleId,
    gatewayRule.id,
    "the hold must survive source reordering while the blocked story remains in the cluster",
  );

  console.log(
    "News candidate quarantine regression passed: Gateway is held permanently with an auditable reason while unrelated policy stories remain eligible.",
  );
}

main();
