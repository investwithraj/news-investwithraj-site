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
  /** Model-emitted citation markup retained for reviewer context only. It is
   *  not independent evidence and cannot satisfy an automated source gate. */
  citedText?: string;
  /**
   * Text fetched from the cited URL itself. Model-emitted citation markup is
   * not evidence and must never populate this field.
   */
  fetchedEvidence?: {
    url: string;
    finalUrl?: string;
    text: string;
    fetchedAt: string;
    contentHash?: string;
  }[];
}

export interface EvidenceApproval {
  hash: string;
  revision: number;
  contentHash: string;
  sourceUrls: string[];
  evidenceHashes: { url: string; contentHash: string }[];
  reviewer: "raj-review-session" | "deterministic-auto-publisher";
  approvedAt: string;
}

/** Immutable approval record derived from the publication branch's bytes. */
export interface MediaApprovalLedger {
  hash: string;
  revision: number;
  contentHash: string;
  slug: string;
  repoPath: string;
  contentSha256: string;
  mime: "image/jpeg" | "image/png" | "image/webp";
  width: number;
  height: number;
  sourceUrl: string;
  rightsStatus: string;
  credit: string;
  reviewer: "raj-review-session";
  approvedAt: string;
}

export interface PublicationRecord {
  state: "publishing" | "committed" | "completed";
  claimId: string;
  revision: number;
  contentHash: string;
  mediaApprovalHash: string;
  evidenceApprovalHash: string;
  startedAt: string;
  updatedAt: string;
  commitSha?: string;
  url?: string;
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
  revision: number;
  /** Monotonic CAS version incremented on every stored-record mutation. */
  recordVersion: number;
  contentHash: string;
  evidenceApproval?: EvidenceApproval;
  mediaApproval?: MediaApprovalLedger;
  publication?: PublicationRecord;
}

/** Payload the pipeline / cron posts to create a draft. */
export interface NewsDraftInput {
  article: DraftArticle;
  provenance: NewsDraftProvenance;
  reviewNote?: string;
  reservationToken?: string;
}

export interface PublicationReceipt {
  draftId: string;
  slug: string;
  revision: number;
  contentHash: string;
  mediaApprovalHash: string;
  evidenceApprovalHash: string;
  commitSha: string;
  url: string;
  completedAt: string;
  expiresAt: string;
}

export interface ClusterReservation {
  clusterId: string;
  token: string;
  state: "processing" | "staged" | "failed";
  topic: string;
  startedAt: string;
  updatedAt: string;
  expiresAt: string;
  draftId?: string;
  result?: string;
}
