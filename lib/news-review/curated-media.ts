import { getCuratedNewsCandidate } from "./curated-candidates";
import { hasApprovedCuratedMediaContext, PRESTIGE_ONE_CONTEXT_MEDIA } from "./curated-media-context";
import { draftContentHash, mediaApprovalHash, sha256Json } from "./integrity";
import type { MediaApprovalLedger, NewsDraft } from "./types";

export { PRESTIGE_ONE_CONTEXT_MEDIA } from "./curated-media-context";

export class CuratedMediaReuseError extends Error {
  constructor(message: string, public readonly status: number = 409) {
    super(message);
    this.name = "CuratedMediaReuseError";
  }
}

export interface CuratedMediaReuseRequest {
  candidateKey: string;
  expectedRevision: number;
  expectedRecordVersion: number;
  expectedContentHash: string;
}

export interface CuratedMediaReuseResponse {
  ok?: boolean;
  mediaApproval?: MediaApprovalLedger;
  revision?: number;
  recordVersion?: number;
  contentHash?: string;
}

type InspectedMedia = Pick<MediaApprovalLedger,
  "repoPath" | "contentSha256" | "mime" | "width" | "height">;

export interface CuratedMediaReuseDependencies {
  getDraft: (id: string) => Promise<NewsDraft | null>;
  inspectEditorialMedia: (slug: string) => Promise<InspectedMedia>;
  setMediaApproval: (
    id: string,
    approval: MediaApprovalLedger,
    expected: { revision: number; recordVersion: number; contentHash: string },
  ) => Promise<NewsDraft | null>;
  now?: () => string;
}

export function parseCuratedMediaReuseRequest(value: unknown): CuratedMediaReuseRequest {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new CuratedMediaReuseError("A bounded media-reuse request is required.", 400);
  }
  const body = value as Record<string, unknown>;
  if (Object.keys(body).sort().join(",") !==
      "candidateKey,expectedContentHash,expectedRecordVersion,expectedRevision" ||
    typeof body.candidateKey !== "string" || body.candidateKey.length > 100 ||
    typeof body.expectedRevision !== "number" ||
    !Number.isSafeInteger(body.expectedRevision) || body.expectedRevision < 1 ||
    typeof body.expectedRecordVersion !== "number" ||
    !Number.isSafeInteger(body.expectedRecordVersion) || body.expectedRecordVersion < 1 ||
    typeof body.expectedContentHash !== "string" ||
    !/^[a-f0-9]{64}$/u.test(body.expectedContentHash)) {
    throw new CuratedMediaReuseError("Only the candidate key and exact draft revision, record version and hash are accepted.", 400);
  }
  if (body.candidateKey !== PRESTIGE_ONE_CONTEXT_MEDIA.candidateKey) {
    throw new CuratedMediaReuseError("This candidate has no owner-approved media reuse.", 403);
  }
  return body as unknown as CuratedMediaReuseRequest;
}

function assertCandidateContext(draft: NewsDraft): void {
  const binding = PRESTIGE_ONE_CONTEXT_MEDIA;
  const candidate = getCuratedNewsCandidate(binding.candidateKey);
  if (draft.id !== binding.draftId || draft.article.slug !== binding.slug ||
    !hasApprovedCuratedMediaContext(draft.article) ||
    sha256Json(draft.article) !== sha256Json(candidate.article) ||
    draftContentHash(draft.article, draft.provenance) !== draft.contentHash) {
    throw new CuratedMediaReuseError("The media reuse is not bound to this exact curated article and context.");
  }
}

function assertExpectedDraft(draft: NewsDraft, request: CuratedMediaReuseRequest): void {
  assertCandidateContext(draft);
  if (draft.status !== "review" || draft.publication ||
    draft.revision !== request.expectedRevision ||
    draft.recordVersion !== request.expectedRecordVersion ||
    draft.contentHash !== request.expectedContentHash) {
    throw new CuratedMediaReuseError("Draft changed; reload before reusing approved media.");
  }
}

function expectedMediaFields() {
  const binding = PRESTIGE_ONE_CONTEXT_MEDIA;
  return {
    slug: binding.slug,
    repoPath: binding.repoPath,
    contentSha256: binding.contentSha256,
    mime: binding.mime,
    width: binding.width,
    height: binding.height,
    sourceUrl: binding.sourceUrl,
    rightsStatus: binding.rightsStatus,
    credit: binding.credit,
    reviewer: "owner-approved-stock-reuse" as const,
    reuseReceipt: { ...binding.reuseReceipt },
  };
}

/** Also used immediately before publication; unrelated candidates are unchanged. */
export function assertRequiredCuratedMediaApproval(draft: NewsDraft): void {
  const binding = PRESTIGE_ONE_CONTEXT_MEDIA;
  if (draft.id !== binding.draftId && draft.article.slug !== binding.slug) return;
  assertCandidateContext(draft);
  const approval = draft.mediaApproval;
  if (!approval) throw new CuratedMediaReuseError("This curated article requires its approved Dubai-context image.", 422);
  const { hash, ...record } = approval;
  const expected = {
    revision: draft.revision,
    contentHash: draft.contentHash,
    ...expectedMediaFields(),
    approvedAt: approval.approvedAt,
  };
  if (!Number.isFinite(Date.parse(approval.approvedAt)) ||
    approval.revision !== draft.revision || approval.contentHash !== draft.contentHash ||
    mediaApprovalHash(record) !== hash || sha256Json(record) !== sha256Json(expected)) {
    throw new CuratedMediaReuseError("The required curated media ledger is missing, changed or stale.");
  }
}

export async function reuseApprovedCuratedMedia(
  draftId: string,
  input: unknown,
  dependencies: CuratedMediaReuseDependencies,
): Promise<NewsDraft> {
  const request = parseCuratedMediaReuseRequest(input);
  const binding = PRESTIGE_ONE_CONTEXT_MEDIA;
  if (draftId !== binding.draftId) {
    throw new CuratedMediaReuseError("This draft has no owner-approved media reuse.", 403);
  }
  const draft = await dependencies.getDraft(draftId);
  if (!draft) throw new CuratedMediaReuseError("Draft not found.", 404);
  assertExpectedDraft(draft, request);

  // Reinspect even on retries: an old matching ledger cannot approve new bytes.
  const inspected = await dependencies.inspectEditorialMedia(binding.slug);
  for (const field of ["repoPath", "contentSha256", "mime", "width", "height"] as const) {
    if (inspected[field] !== binding[field]) {
      throw new CuratedMediaReuseError("Publication-branch image bytes do not match the exact owner-approved original.");
    }
  }
  if (draft.mediaApproval) {
    const latest = await dependencies.getDraft(draftId);
    if (!latest) throw new CuratedMediaReuseError("Draft not found.", 404);
    assertExpectedDraft(latest, request);
    assertRequiredCuratedMediaApproval(latest);
    return latest;
  }

  const record: Omit<MediaApprovalLedger, "hash"> = {
    revision: draft.revision,
    contentHash: draft.contentHash,
    ...expectedMediaFields(),
    approvedAt: dependencies.now?.() ?? new Date().toISOString(),
  };
  const approval = { ...record, hash: mediaApprovalHash(record) };
  const updated = await dependencies.setMediaApproval(draftId, approval, {
    revision: draft.revision,
    recordVersion: draft.recordVersion,
    contentHash: draft.contentHash,
  });
  if (!updated) throw new CuratedMediaReuseError("Draft not found.", 404);
  assertRequiredCuratedMediaApproval(updated);
  if (updated.recordVersion !== draft.recordVersion + 1) {
    throw new CuratedMediaReuseError("Media reuse returned an unexpected draft record version.");
  }
  return updated;
}

/** A stage may emit publication outputs only after the exact approval is returned. */
export async function ensureCuratedMediaApproval(
  candidateKey: string,
  draft: NewsDraft,
  post: (pathname: string, body: CuratedMediaReuseRequest) => Promise<{
    response: Pick<Response, "ok" | "status">;
    payload: CuratedMediaReuseResponse;
  }>,
): Promise<void> {
  if (candidateKey !== PRESTIGE_ONE_CONTEXT_MEDIA.candidateKey) {
    if (draft.id === PRESTIGE_ONE_CONTEXT_MEDIA.draftId ||
      draft.article.slug === PRESTIGE_ONE_CONTEXT_MEDIA.slug) {
      throw new CuratedMediaReuseError("The required media candidate key does not match.");
    }
    return;
  }
  assertCandidateContext(draft);
  const { response, payload } = await post(
    `/api/news/draft/${encodeURIComponent(draft.id)}/reuse-curated-media`,
    {
      candidateKey,
      expectedRevision: draft.revision,
      expectedRecordVersion: draft.recordVersion,
      expectedContentHash: draft.contentHash,
    },
  );
  if (!response.ok || payload.ok !== true || !payload.mediaApproval ||
    payload.revision !== draft.revision || payload.contentHash !== draft.contentHash ||
    (payload.recordVersion !== draft.recordVersion &&
      payload.recordVersion !== draft.recordVersion + 1)) {
    throw new CuratedMediaReuseError(`Required curated media approval failed closed (${response.status}).`);
  }
  assertRequiredCuratedMediaApproval({ ...draft, mediaApproval: payload.mediaApproval });
}
