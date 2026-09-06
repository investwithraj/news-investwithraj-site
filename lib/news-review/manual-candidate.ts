import type { Cluster } from "@/lib/pipeline/types";

export const MANUAL_NEWS_CANDIDATE_KEYS = [
  "dld-initial-registration",
] as const;

export type ManualNewsCandidateKey =
  (typeof MANUAL_NEWS_CANDIDATE_KEYS)[number];

function normalizedEntryText(cluster: Cluster): string {
  return cluster.entries
    .map((entry) => `${entry.title}\n${entry.summary}`)
    .join("\n")
    .toLowerCase();
}

function matchesManualCandidate(
  cluster: Cluster,
  key: ManualNewsCandidateKey,
): boolean {
  const text = normalizedEntryText(cluster);
  switch (key) {
    case "dld-initial-registration":
      return (
        text.includes("initial registration") &&
        (text.includes("dubai land department") || /\bdld\b/u.test(text))
      );
  }
}

/** Scheduled runs retain the ordinary score gate. A manual recovery run may
 * select one exact, version-controlled editorial event that has already been
 * reviewed but was split below the generic score threshold. The publication
 * evidence and article gates remain unchanged. */
export function selectDraftClusters(
  clusters: Cluster[],
  minimumScore: number,
  requestedKey = "auto",
): Cluster[] {
  const key = requestedKey.trim().toLowerCase();
  if (!key || key === "auto") {
    return clusters.filter((cluster) => cluster.score >= minimumScore);
  }
  if (!MANUAL_NEWS_CANDIDATE_KEYS.includes(key as ManualNewsCandidateKey)) {
    throw new Error(`Unknown manual news candidate key: ${key.slice(0, 80)}`);
  }
  return clusters.filter((cluster) =>
    matchesManualCandidate(cluster, key as ManualNewsCandidateKey),
  );
}
