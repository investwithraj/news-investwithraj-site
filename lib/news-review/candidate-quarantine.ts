import type { Cluster } from "@/lib/pipeline/types";

/**
 * Version-controlled editorial holds for source clusters that must never enter
 * automated research or publishing. Rules deliberately match both the cluster
 * bucket and an exact story title: some buckets (notably `policy`) are shared
 * by otherwise valid stories and must not be disabled wholesale.
 */
export interface NewsClusterQuarantineRule {
  id: string;
  clusterId: string;
  topic: string;
  reason: string;
  provenance: {
    sourceName: string;
    sourceDomain: string;
    sourcePublishedAt: string;
    reviewedAt: string;
  };
}

export interface NewsClusterQuarantineHold {
  ruleId: string;
  clusterId: string;
  topic: string;
  reason: string;
  provenance: NewsClusterQuarantineRule["provenance"];
}

export const NEWS_CLUSTER_QUARANTINE = [
  {
    id: "gateway-2040-us-residency-promotion-2026-09-05",
    clusterId: "policy",
    topic:
      "Gateway 2040 brings Orlando infrastructure investment and pathway to US permanent residency to Dubai’s International Property Show",
    reason:
      "Permanent editorial hold: Gateway 2040 is an overseas-residency promotion, not a Dubai real-estate market report. Automatic research and publication are disabled until this rule is explicitly removed in review.",
    provenance: {
      sourceName: "Zawya via Google News",
      sourceDomain: "zawya.com",
      sourcePublishedAt: "2026-09-05T20:01:00.000Z",
      reviewedAt: "2026-09-07",
    },
  },
] as const satisfies readonly NewsClusterQuarantineRule[];

function normaliseTopic(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/\s+/gu, " ")
    .trim()
    .toLocaleLowerCase("en");
}

function normaliseDomain(value: string): string {
  return value.trim().toLocaleLowerCase("en").replace(/^www\./u, "");
}

/** Return the auditable hold that blocks a cluster, or null when it is eligible. */
export function findNewsClusterQuarantine(
  cluster: Cluster,
): NewsClusterQuarantineHold | null {
  for (const rule of NEWS_CLUSTER_QUARANTINE) {
    if (cluster.id !== rule.clusterId) continue;
    const blockedTopic = normaliseTopic(rule.topic);
    const blockedDomain = normaliseDomain(rule.provenance.sourceDomain);
    const containsBlockedStory = cluster.entries.some(
      (entry) =>
        normaliseTopic(entry.title) === blockedTopic &&
        normaliseDomain(entry.source.domain) === blockedDomain &&
        entry.publishedAt === rule.provenance.sourcePublishedAt,
    );
    if (!containsBlockedStory) continue;
    return {
      ruleId: rule.id,
      clusterId: cluster.id,
      topic: rule.topic,
      reason: rule.reason,
      provenance: rule.provenance,
    };
  }
  return null;
}
