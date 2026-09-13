import type { Cluster } from "@/lib/pipeline/types";
import { isTimelyPrimaryPropertyEntry } from "@/lib/pipeline/cluster";

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

/** Scheduled runs retain ordinary ranking. Only an empty score-qualified pool
 * may receive one timely primary-property announcement for normal research.
 * A manual recovery run may
 * select one exact, version-controlled editorial event that has already been
 * reviewed but was split below the generic score threshold. The publication
 * evidence and article gates remain unchanged. */
export function selectDraftClusters(
  clusters: Cluster[],
  minimumScore: number,
  requestedKey = "auto",
  now = new Date(),
): Cluster[] {
  const key = requestedKey.trim().toLowerCase();
  if (!key || key === "auto") {
    const ranked = clusters.filter((cluster) => cluster.score >= minimumScore);
    if (ranked.length > 0) return ranked;
    // The entry that supplies the topic must itself pass every fallback gate;
    // a foreign/stale/non-property topic cannot borrow another entry's status.
    const fallback = clusters.find((cluster) => cluster.entries.some((entry) =>
      entry.title === cluster.topic && isTimelyPrimaryPropertyEntry(entry, now.getTime())));
    return fallback ? [fallback] : [];
  }
  if (!MANUAL_NEWS_CANDIDATE_KEYS.includes(key as ManualNewsCandidateKey)) {
    throw new Error(`Unknown manual news candidate key: ${key.slice(0, 80)}`);
  }
  return clusters.filter((cluster) =>
    matchesManualCandidate(cluster, key as ManualNewsCandidateKey),
  );
}
