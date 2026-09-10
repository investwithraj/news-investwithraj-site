import {
  expectedDailyMediaFields,
  hasApprovedDailyMediaContext,
  selectDailyNewsMedia,
} from "./daily-media-catalog";
import { assertCanonicalNewsSlug, draftContentHash, mediaApprovalHash, sha256Json } from "./integrity";
import type { DraftArticle, MediaApprovalLedger, NewsDraft } from "./types";

export class DailyMediaReuseError extends Error {
  constructor(message: string, public readonly status: number = 409) {
    super(message);
    this.name = "DailyMediaReuseError";
  }
}

export interface DailyMediaReuseRequest {
  expectedRevision: number;
  expectedRecordVersion: number;
  expectedContentHash: string;
}

export interface DailyMediaReuseResponse {
  ok?: boolean;
  mediaApproval?: MediaApprovalLedger;
  revision?: number;
  recordVersion?: number;
  contentHash?: string;
}

type InspectedMedia = Pick<MediaApprovalLedger,
  "repoPath" | "contentSha256" | "mime" | "width" | "height">;

export interface DailyMediaReuseDependencies {
  getDraft: (id: string) => Promise<NewsDraft | null>;
  ensureApprovedDailyMediaCover: (article: DraftArticle) => Promise<InspectedMedia>;
  inspectEditorialMedia: (slug: string) => Promise<InspectedMedia>;
  setMediaApproval: (
    id: string,
    approval: MediaApprovalLedger,
    expected: { revision: number; recordVersion: number; contentHash: string },
  ) => Promise<NewsDraft | null>;
  now?: () => string;
}

export function assertDailyMediaDraftId(id: unknown): asserts id is string {
  if (typeof id !== "string" || !/^[A-Za-z0-9_-]{1,128}$/u.test(id)) {
    throw new DailyMediaReuseError("Invalid draft ID.", 400);
  }
}

export function parseDailyMediaReuseRequest(value: unknown): DailyMediaReuseRequest {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new DailyMediaReuseError("A bounded media-reuse request is required.", 400);
  }
  const body = value as Record<string, unknown>;
  if (Object.keys(body).sort().join(",") !==
      "expectedContentHash,expectedRecordVersion,expectedRevision" ||
    typeof body.expectedRevision !== "number" ||
    !Number.isSafeInteger(body.expectedRevision) || body.expectedRevision < 1 ||
    typeof body.expectedRecordVersion !== "number" ||
    !Number.isSafeInteger(body.expectedRecordVersion) || body.expectedRecordVersion < 1 ||
    typeof body.expectedContentHash !== "string" ||
    !/^[a-f0-9]{64}$/u.test(body.expectedContentHash)) {
    throw new DailyMediaReuseError("Only the exact draft revision, record version and content hash are accepted.", 400);
  }
  return body as unknown as DailyMediaReuseRequest;
}

function assertArticleContext(draft: NewsDraft): void {
  assertCanonicalNewsSlug(draft.article.slug);
  if (!selectDailyNewsMedia(draft.article) || !hasApprovedDailyMediaContext(draft.article) ||
    draftContentHash(draft.article, draft.provenance) !== draft.contentHash) {
    throw new DailyMediaReuseError("This article has no matching owner-approved daily media context.", 422);
  }
}

function assertExpectedDraft(draft: NewsDraft, id: string, request: DailyMediaReuseRequest): void {
  assertArticleContext(draft);
  if (draft.id !== id || draft.status !== "review" || draft.publication ||
    draft.revision !== request.expectedRevision ||
    draft.recordVersion !== request.expectedRecordVersion ||
    draft.contentHash !== request.expectedContentHash) {
    throw new DailyMediaReuseError("Draft changed; reload before reusing approved media.");
  }
}

function assertInspected(draft: NewsDraft, inspected: InspectedMedia): void {
  const expected = expectedDailyMediaFields(draft.article);
  if (!expected || ["repoPath", "contentSha256", "mime", "width", "height"].some((key) => {
    const field = key as keyof InspectedMedia;
    return inspected[field] !== expected[field];
  })) {
    throw new DailyMediaReuseError("Publication-branch image bytes do not match the owner-approved original.");
  }
}

/** Verify the immutable record, never infer approval from article metadata alone. */
export function assertRequiredDailyMediaApproval(draft: NewsDraft): void {
  assertArticleContext(draft);
  const expectedFields = expectedDailyMediaFields(draft.article);
  const approval = draft.mediaApproval;
  if (!expectedFields || !approval) {
    throw new DailyMediaReuseError("This daily update requires its approved context image.", 422);
  }
  const { hash, ...record } = approval;
  const expected: Omit<MediaApprovalLedger, "hash"> = {
    revision: draft.revision,
    contentHash: draft.contentHash,
    ...expectedFields,
    approvedAt: approval.approvedAt,
  };
  // An exact existing human approval is sufficient. It is never rewritten or
  // converted into an automatic receipt by this service.
  if (approval.reviewer === "raj-review-session") {
    expected.reviewer = "raj-review-session";
    delete expected.reuseReceipt;
  }
  if (!Number.isFinite(Date.parse(approval.approvedAt)) ||
    mediaApprovalHash(record) !== hash || sha256Json(record) !== sha256Json(expected)) {
    throw new DailyMediaReuseError("The daily media approval is changed, stale or bound to another image.");
  }
}

export async function reuseApprovedDailyMedia(
  draftId: string,
  input: unknown,
  dependencies: DailyMediaReuseDependencies,
): Promise<NewsDraft> {
  assertDailyMediaDraftId(draftId);
  const request = parseDailyMediaReuseRequest(input);
  const draft = await dependencies.getDraft(draftId);
  if (!draft) throw new DailyMediaReuseError("Draft not found.", 404);
  assertExpectedDraft(draft, draftId, request);

  if (draft.mediaApproval) {
    // Never create or replace an asset underneath an existing approval.
    assertRequiredDailyMediaApproval(draft);
  } else {
    assertInspected(draft, await dependencies.ensureApprovedDailyMediaCover(draft.article));
  }
  // Independent inspection uses the current publication branch, including on
  // retries. A ledger cannot make changed or absent bytes acceptable.
  assertInspected(draft, await dependencies.inspectEditorialMedia(draft.article.slug));

  const latest = await dependencies.getDraft(draftId);
  if (!latest) throw new DailyMediaReuseError("Draft not found.", 404);
  assertExpectedDraft(latest, draftId, request);
  if (draft.mediaApproval) {
    assertRequiredDailyMediaApproval(latest);
    if (latest.mediaApproval?.hash !== draft.mediaApproval.hash) {
      throw new DailyMediaReuseError("The media approval changed during reuse.");
    }
    return latest;
  }
  if (latest.mediaApproval) throw new DailyMediaReuseError("A media approval already exists; reload before continuing.");

  const expectedFields = expectedDailyMediaFields(latest.article);
  if (!expectedFields) throw new DailyMediaReuseError("No daily media selection is available.", 422);
  const record: Omit<MediaApprovalLedger, "hash"> = {
    revision: latest.revision,
    contentHash: latest.contentHash,
    ...expectedFields,
    approvedAt: dependencies.now?.() ?? new Date().toISOString(),
  };
  if (!Number.isFinite(Date.parse(record.approvedAt))) {
    throw new DailyMediaReuseError("A valid media approval time is required.");
  }
  const approval = { ...record, hash: mediaApprovalHash(record) };
  const updated = await dependencies.setMediaApproval(draftId, approval, {
    revision: latest.revision,
    recordVersion: latest.recordVersion,
    contentHash: latest.contentHash,
  });
  if (!updated) throw new DailyMediaReuseError("Draft not found.", 404);
  assertRequiredDailyMediaApproval(updated);
  if (updated.id !== draftId || updated.status !== "review" || updated.revision !== latest.revision ||
    updated.contentHash !== latest.contentHash || updated.publication ||
    updated.recordVersion !== latest.recordVersion + 1 || updated.mediaApproval?.hash !== approval.hash) {
    throw new DailyMediaReuseError("Media reuse returned an unexpected draft record.");
  }
  return updated;
}

/** Call only for a catalogue-bound daily update; outputs remain withheld on failure. */
export async function ensureDailyMediaApproval(
  draft: NewsDraft,
  post: (pathname: string, body: DailyMediaReuseRequest) => Promise<{
    response: Pick<Response, "ok" | "status">;
    payload: DailyMediaReuseResponse;
  }>,
): Promise<void> {
  assertDailyMediaDraftId(draft.id);
  assertArticleContext(draft);
  const { response, payload } = await post(
    `/api/news/draft/${encodeURIComponent(draft.id)}/reuse-daily-media`,
    {
      expectedRevision: draft.revision,
      expectedRecordVersion: draft.recordVersion,
      expectedContentHash: draft.contentHash,
    },
  );
  if (!response.ok || payload.ok !== true || !payload.mediaApproval ||
    payload.revision !== draft.revision || payload.contentHash !== draft.contentHash ||
    payload.recordVersion !== draft.recordVersion + (draft.mediaApproval ? 0 : 1)) {
    throw new DailyMediaReuseError(`Required daily media approval failed closed (${response.status}).`);
  }
  assertRequiredDailyMediaApproval({ ...draft, mediaApproval: payload.mediaApproval });
}
