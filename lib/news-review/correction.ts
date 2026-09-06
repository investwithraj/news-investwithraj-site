import { createHash } from "node:crypto";

import { assessDraft } from "@/lib/news-review/auto-approve";
import {
  draftContentHash,
  evidenceApprovalFor,
  reassessPublicationEvidence,
  validateDraftArticleShape,
  validateProvenanceShape,
  WITHHELD_MEDIA_APPROVAL_HASH,
} from "@/lib/news-review/integrity";
import {
  getArchivedPublicationDraft,
  storeCorrectionDraft,
  validateArticle,
} from "@/lib/news-review/storage";
import type { DraftArticle, NewsDraft } from "@/lib/news-review/types";

export interface PublishedCorrectionManifest {
  originalDraftId: string;
  expectedOriginalCommitSha: string;
  expectedOriginalContentHash: string;
  article: DraftArticle;
}

export interface PreparedCorrection {
  draft: NewsDraft;
  state: "active" | "completed";
}

function samePublicationIdentity(
  article: DraftArticle,
  original: DraftArticle,
): boolean {
  return (
    article.slug === original.slug &&
    article.publishedAt === original.publishedAt &&
    article.author === original.author &&
    article.tier === original.tier &&
    article.category === original.category &&
    sameJson(article.market, original.market)
  );
}

/** Re-prove correction lineage immediately before a publication claim. */
export async function assertPublishedCorrectionLineage(
  draft: NewsDraft,
): Promise<void> {
  const hasDisclosure = Boolean(draft.article.correction);
  const hasOrigin = Boolean(draft.correctionOf);
  if (hasDisclosure !== hasOrigin) {
    throw new Error(
      "A correction disclosure and completed-publication lineage must appear together.",
    );
  }
  if (!draft.correctionOf) return;

  const origin = draft.correctionOf;
  if (
    !/^[A-Za-z0-9_-]{1,128}$/.test(origin.draftId) ||
    !Number.isSafeInteger(origin.revision) ||
    origin.revision < 1 ||
    !/^[a-f0-9]{64}$/.test(origin.contentHash) ||
    !/^[a-f0-9]{40}$/i.test(origin.commitSha)
  ) {
    throw new Error("Correction lineage is malformed.");
  }
  const original = await getArchivedPublicationDraft(origin.draftId);
  if (
    !original?.publication ||
    original.publication.state !== "completed" ||
    original.revision !== origin.revision ||
    original.contentHash !== origin.contentHash ||
    original.publication.contentHash !== origin.contentHash ||
    original.publication.commitSha?.toLowerCase() !==
      origin.commitSha.toLowerCase()
  ) {
    throw new Error("Correction lineage does not match a completed publication.");
  }
  if (!reassessPublicationEvidence(original)) {
    throw new Error("Correction lineage evidence is obsolete or invalid.");
  }
  if (
    original.mediaApproval ||
    original.publication.mediaApprovalHash !==
      WITHHELD_MEDIA_APPROVAL_HASH
  ) {
    throw new Error(
      "Correction lineage with approved media requires a separate signed media review.",
    );
  }
  if (
    !samePublicationIdentity(draft.article, original.article) ||
    !sameJson(draft.article.citations, original.article.citations) ||
    Object.keys(draft.article.distribution).length !== 0 ||
    Date.parse(draft.article.modifiedAt) <=
      Date.parse(original.article.modifiedAt) ||
    draft.contentHash === original.contentHash
  ) {
    throw new Error("Correction content no longer matches its archived lineage.");
  }
}

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function deterministicCorrectionId(originalId: string, contentHash: string) {
  const identity = createHash("sha256")
    .update(`${originalId}:${contentHash}`)
    .digest("hex")
    .slice(0, 32);
  return `correction-${identity}`;
}

export async function stagePublishedCorrection(
  manifest: PublishedCorrectionManifest,
  now = new Date().toISOString(),
): Promise<PreparedCorrection> {
  if (
    !/^[A-Za-z0-9_-]{1,128}$/.test(manifest.originalDraftId) ||
    !/^[a-f0-9]{40}$/i.test(manifest.expectedOriginalCommitSha) ||
    !/^[a-f0-9]{64}$/.test(manifest.expectedOriginalContentHash)
  ) {
    throw new Error("Correction manifest identity is invalid.");
  }

  const articleResult = validateDraftArticleShape(manifest.article);
  if (!articleResult.ok) throw new Error(articleResult.error);
  const article = articleResult.article;
  if (!article.correction) {
    throw new Error("A visible correction disclosure is required.");
  }
  if (Object.keys(article.distribution).length !== 0) {
    throw new Error("Correction distribution must remain disabled.");
  }

  const original = await getArchivedPublicationDraft(manifest.originalDraftId);
  if (!original?.publication || original.publication.state !== "completed") {
    throw new Error("The completed publication archive was not found.");
  }
  if (
    original.contentHash !== manifest.expectedOriginalContentHash ||
    original.publication.contentHash !== manifest.expectedOriginalContentHash ||
    original.publication.commitSha?.toLowerCase() !==
      manifest.expectedOriginalCommitSha.toLowerCase()
  ) {
    throw new Error("Correction manifest does not match the completed publication.");
  }
  if (!reassessPublicationEvidence(original)) {
    throw new Error("The archived publication evidence is obsolete or invalid.");
  }
  if (original.mediaApproval) {
    throw new Error(
      "Corrections to approved editorial media require a separate signed media review.",
    );
  }
  if (
    original.publication.mediaApprovalHash !==
    WITHHELD_MEDIA_APPROVAL_HASH
  ) {
    throw new Error("The archived publication does not prove withheld media.");
  }
  if (!samePublicationIdentity(article, original.article)) {
    throw new Error("Correction cannot change the publication identity.");
  }
  if (!sameJson(article.citations, original.article.citations)) {
    throw new Error(
      "Correction citations must exactly match the archived evidence set.",
    );
  }
  if (Date.parse(article.modifiedAt) <= Date.parse(original.article.modifiedAt)) {
    throw new Error("Correction modifiedAt must be later than the original revision.");
  }

  const provenanceResult = validateProvenanceShape(
    original.provenance,
    article.citations.map((citation) => citation.url),
  );
  if (!provenanceResult.ok) throw new Error(provenanceResult.error);
  const provenance = provenanceResult.provenance;
  const contentHash = draftContentHash(article, provenance);
  if (contentHash === original.contentHash) {
    throw new Error("Correction must materially change the reviewed content.");
  }
  const validator = validateArticle(article);
  if (!validator.ok) {
    throw new Error("Correction fails the current article validator.");
  }

  const revision = original.revision + 1;
  const verifiedSources = article.citations.map((citation) => citation.url);
  const evidenceApproval = evidenceApprovalFor(
    revision,
    contentHash,
    verifiedSources,
    provenance,
    article,
    now,
    "deterministic-auto-publisher",
  );
  if (!evidenceApproval) {
    throw new Error("Correction does not pass the current evidence policy.");
  }

  const createdAt = now;
  const candidate: NewsDraft = {
    id: deterministicCorrectionId(original.id, contentHash),
    createdAt,
    updatedAt: createdAt,
    status: "review",
    article,
    validator,
    provenance,
    reviewNote:
      "Version-controlled material correction with a reader-visible disclosure.",
    verifiedSources,
    revision,
    recordVersion: 1,
    contentHash,
    evidenceApproval,
    correctionOf: {
      draftId: original.id,
      revision: original.revision,
      contentHash: original.contentHash,
      commitSha: original.publication.commitSha,
    },
  };
  const assessment = assessDraft(candidate);
  if (assessment.verdict !== "auto-approve") {
    throw new Error(
      `Correction is held by the current evidence policy: ${assessment.reasons.join("; ")}`,
    );
  }

  return storeCorrectionDraft(candidate);
}
