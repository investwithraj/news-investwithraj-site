// News article review-staging types.
//
// A NewsDraft is an article awaiting Raj's editorial review. It lives in KV
// (never in git) until approved — at which point the publish route generates
// the content/news/<slug>.ts file and commits it once. The draft carries its
// own validator result + provenance (the source cluster) so the review cockpit
// can show, for every number in the body, exactly which source backs it.

import type { NewsArticle } from "@/content/news/types";
import type { ValidationResult } from "@/lib/voice/validator";

/** The article content under review — the full NewsArticle shape minus the
 *  publication-state flag (status is set to "live" only at publish time). */
export type DraftArticle = Omit<NewsArticle, "status">;

/** One source from the originating cluster — shown in the provenance rail so
 *  Raj can verify each figure against a real source. */
export interface ProvenanceSource {
  name: string;
  tier: string;
  url: string;
  summary: string;
  publishedAt?: string;
}

/** Where the draft came from — the cluster the pipeline scored + selected. */
export interface NewsDraftProvenance {
  clusterId: string;
  topic: string;
  score: number;
  scoreBreakdown: {
    uhnwRelevance: number;
    sourceTier: number;
    freshness: number;
    rajAngle: number;
  };
  sources: ProvenanceSource[];
  /** Concatenated text the web-research drafter wrapped in <cite> tags — i.e.
   *  figures Claude attributed to a real source. The cockpit treats a figure
   *  found here as source-backed (gold), so only genuinely-uncited figures get
   *  flagged for manual checking. */
  citedText?: string;
}

/** A staged article draft (status always "review" while in KV). */
export interface NewsDraft {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: "review";
  article: DraftArticle;
  /** Recomputed on every write so the cockpit always shows accurate gates. */
  validator: ValidationResult;
  provenance: NewsDraftProvenance;
  /** Optional note from Raj when requesting a redraft. */
  reviewNote?: string;
  /** Source URLs Raj has ticked "verified" — drives the Approve soft-lock. */
  verifiedSources?: string[];
}

/** Payload the pipeline / cron posts to create a draft. */
export interface NewsDraftInput {
  article: DraftArticle;
  provenance: NewsDraftProvenance;
  reviewNote?: string;
}
