// Pipeline data structures — what flows between fetch → dedupe → cluster → draft.

import type { RawEntry } from "@/lib/sources/fetchers";

/** A topical cluster of raw entries about the same event/entity.
 *  e.g. multiple sources covering the same Modon launch all collapse into
 *  one Cluster which the drafter turns into a single article. */
export interface Cluster {
  /** Stable cluster ID — slug-format, derived from primary entity */
  id: string;
  /** Editorial topic label — drives the article category */
  topic: string;
  /** The entries that belong to this cluster, sorted by source tier */
  entries: RawEntry[];
  /** Composite score 0-100 — drives ranking + per-day cap selection */
  score: number;
  /** Per-axis score breakdown for transparency in logs */
  scoreBreakdown: {
    uhnwRelevance: number;
    sourceTier: number;
    freshness: number;
    rajAngle: number;
  };
  /** Named entities extracted from the cluster — developers, places, deals */
  entities: ClusterEntities;
  /** Suggested category for the resulting NewsArticle */
  suggestedCategory:
    | "market-pulse"
    | "launch"
    | "regulatory"
    | "macro"
    | "developer-corporate"
    | "infrastructure"
    | "policy";
  /** Suggested geographic markets */
  suggestedMarkets: ("Dubai" | "Abu Dhabi" | "Ras Al Khaimah" | "UAE" | "GCC")[];
}

export interface ClusterEntities {
  /** Developer names mentioned (Modon, Nakheel, Emaar, etc) */
  developers: string[];
  /** Place names mentioned (Hudayriyat, Palm Jebel Ali, etc) */
  places: string[];
  /** Money figures detected — "AED 11.97B", "$3.9B", etc */
  figures: string[];
  /** Whether at least one tier-1 (government) source is in the cluster */
  hasTier1Source: boolean;
}

export interface PipelineRun {
  startedAt: string;
  finishedAt: string;
  /** Total entries after fetch */
  fetchedCount: number;
  /** Total unique entries after dedupe */
  dedupedCount: number;
  /** Total clusters formed */
  clusterCount: number;
  /** Top-N clusters selected for drafting (capped) */
  selectedCount: number;
  /** The selected clusters, drafting order (highest-scored first) */
  selected: Cluster[];
  /** Notes for the drafter — voice profile location, validator location, etc */
  drafterContext: DrafterContext;
}

export interface DrafterContext {
  /** Path to lib/voice/raj-profile.md — the drafter reads this first */
  voiceProfilePath: string;
  /** Path to lib/voice/validator.ts — the drafter uses this for 8-gate check */
  validatorPath: string;
  /** Path to lib/sources/registry.ts — citation whitelist */
  sourceRegistryPath: string;
  /** Per-article word count target */
  wordCountTarget: { min: number; max: number };
  /** Where to write the output article file (template) */
  outputPathTemplate: string;
}
