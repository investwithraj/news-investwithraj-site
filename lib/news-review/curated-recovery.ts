import { createHash } from "node:crypto";

import type { CuratedNewsCandidate } from "./curated-candidates";
import {
  draftContentHash,
  mediaApprovalHash,
  sha256Json,
  validateProvenanceShape,
  WITHHELD_MEDIA_APPROVAL_HASH,
} from "./integrity";
import {
  CURRENT_EVIDENCE_POLICY_VERSION,
  type NewsDraft,
} from "./types";

const NEWS_ORIGIN = "https://news.investwithraj.com";

export interface CuratedDeploymentRequest {
  pathname: string;
  body: {
    claimId: string;
    deploymentStatus: "READY";
    deployedCommitSha: string;
  };
}

export interface CuratedDeploymentAttempt {
  status: number;
  publicationState?: string;
}

function sameStringSet(left: string[], right: string[]): boolean {
  const a = [...new Set(left)].sort();
  const b = [...new Set(right)].sort();
  return (
    left.length === a.length &&
    right.length === b.length &&
    a.length === b.length &&
    a.every((value, index) => value === b[index])
  );
}

function evidenceLedgerIsBound(draft: NewsDraft): boolean {
  const approval = draft.evidenceApproval;
  const citationUrls = draft.article.citations.map((citation) => citation.url);
  const provenance = validateProvenanceShape(draft.provenance, citationUrls);
  if (!approval || !provenance.ok) return false;
  const { hash, ...payload } = approval;
  if (
    approval.policyVersion !== CURRENT_EVIDENCE_POLICY_VERSION ||
    approval.revision !== draft.revision ||
    approval.contentHash !== draft.contentHash ||
    sha256Json(payload) !== hash ||
    !sameStringSet(approval.sourceUrls, citationUrls) ||
    !sameStringSet(draft.verifiedSources ?? [], citationUrls)
  ) {
    return false;
  }

  const evidence = provenance.provenance.fetchedEvidence ?? [];
  if (evidence.length !== citationUrls.length) return false;
  const expectedHashes = evidence.map((item) => ({
    url: item.url,
    contentHash:
      item.contentHash ?? createHash("sha256").update(item.text).digest("hex"),
  }));
  return approval.evidenceHashes.every((approved) =>
    expectedHashes.some(
      (expected) =>
        expected.url === approved.url &&
        expected.contentHash === approved.contentHash,
    ),
  ) && approval.evidenceHashes.length === expectedHashes.length;
}

function mediaLedgerIsBound(draft: NewsDraft): boolean {
  const approval = draft.mediaApproval;
  if (!approval) {
    return (
      draft.publication?.mediaApprovalHash === WITHHELD_MEDIA_APPROVAL_HASH
    );
  }
  const { hash, ...payload } = approval;
  return (
    mediaApprovalHash(payload) === hash &&
    approval.revision === draft.revision &&
    approval.contentHash === draft.contentHash &&
    draft.publication?.mediaApprovalHash === hash
  );
}

/**
 * Validate the immutable record left after Git commit creation. A recovery
 * caller may use only the returned deployment-completion request; it must not
 * call the publish or staging endpoints again.
 */
export function committedCuratedDeploymentRequest(input: {
  candidate: CuratedNewsCandidate;
  draft: NewsDraft;
  currentEvidenceFingerprint: string;
  storedEvidenceFingerprint: string;
}): CuratedDeploymentRequest {
  const {
    candidate,
    draft,
    currentEvidenceFingerprint,
    storedEvidenceFingerprint,
  } = input;
  const publication = draft.publication;
  const expectedUrl = `${NEWS_ORIGIN}/news/${candidate.article.slug}`;
  if (
    draft.id !== candidate.draftId ||
    draft.article.slug !== candidate.article.slug ||
    sha256Json(draft.article) !== sha256Json(candidate.article) ||
    draftContentHash(draft.article, draft.provenance) !== draft.contentHash ||
    currentEvidenceFingerprint !== storedEvidenceFingerprint ||
    publication?.state !== "committed" ||
    publication.evidencePolicyVersion !== CURRENT_EVIDENCE_POLICY_VERSION ||
    publication.revision !== draft.revision ||
    publication.contentHash !== draft.contentHash ||
    publication.evidenceApprovalHash !== draft.evidenceApproval?.hash ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(
      publication.claimId,
    ) ||
    !/^[a-f0-9]{40}$/iu.test(publication.commitSha ?? "") ||
    publication.url !== expectedUrl ||
    !evidenceLedgerIsBound(draft) ||
    !mediaLedgerIsBound(draft)
  ) {
    throw new Error(
      "The committed curated publication is not exactly bound to its reviewed evidence and approvals.",
    );
  }

  return {
    pathname: `/api/news/draft/${encodeURIComponent(draft.id)}/deployment`,
    body: {
      claimId: publication.claimId,
      deploymentStatus: "READY",
      deployedCommitSha: publication.commitSha!,
    },
  };
}

/** Bounded retry of deployment completion; no publish/stage capability exists. */
export async function recoverCommittedCuratedDeployment(input: {
  request: CuratedDeploymentRequest;
  attempts: number;
  delayMs: number;
  postDeployment: (
    pathname: string,
    body: CuratedDeploymentRequest["body"],
  ) => Promise<CuratedDeploymentAttempt>;
  verifyDurableProof: () => Promise<void>;
  wait?: (delayMs: number) => Promise<void>;
}): Promise<void> {
  const attempts = Math.max(1, Math.min(20, Math.trunc(input.attempts)));
  const delayMs = Math.max(0, Math.min(60_000, Math.trunc(input.delayMs)));
  const wait = input.wait ?? ((ms: number) => new Promise((resolve) => {
    setTimeout(resolve, ms);
  }));

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const result = await input.postDeployment(
      input.request.pathname,
      input.request.body,
    );
    if (result.publicationState === "completed") {
      await input.verifyDurableProof();
      return;
    }
    if ([400, 401, 403, 404].includes(result.status)) {
      throw new Error("Committed deployment recovery was rejected.");
    }
    if (attempt < attempts) await wait(delayMs);
  }
  throw new Error(
    "Committed deployment recovery remains pending after bounded verification.",
  );
}
