// Human-reviewed publication endpoint.
//
// This route creates the one atomic Git commit for an approved article. It
// retains a durable "committed" draft record until a separate deployment
// verifier proves that exact commit is live.

import { NextRequest } from "next/server";

import { NEWS_ARTICLES } from "@/content/news";
import { dubaiCalendarDate } from "@/lib/dubai-time";
import { assessDraft } from "@/lib/news-review/auto-approve";
import { authorize, authorizeMutation } from "@/lib/news-review/auth";
import { assertPublishedCorrectionLineage } from "@/lib/news-review/correction";
import {
  assertRequiredCuratedMediaApproval,
  CuratedMediaReuseError,
} from "@/lib/news-review/curated-media";
import { githubConfigured, publishArticleCommit } from "@/lib/news-review/github";
import {
  findRecentLiveArticleDuplicate,
  NewsDuplicateHoldError,
} from "@/lib/news-review/duplicate-guard";
import {
  draftContentHash,
  mediaApprovalHash,
  reassessEvidenceApproval,
  reassessPublicationEvidence,
  validateDraftArticleShape,
  validateProvenanceShape,
  WITHHELD_MEDIA_APPROVAL_HASH,
} from "@/lib/news-review/integrity";
import {
  publicationFailureDiagnostic,
  type PublicationStage,
} from "@/lib/news-review/publication-diagnostic";
import {
  claimDraftPublication,
  DraftConflictError,
  getDraft,
  getStorageBackend,
  recordDraftPublicationCommit,
  updateReviewedDraft,
  validateArticle,
} from "@/lib/news-review/storage";
import { validatedDubaiMorningDate } from "@/lib/news-scheduler/day";
import {
  KvAutomatedPublicationDayLedger,
  type AutomatedPublicationDayIdentity,
} from "@/lib/news-scheduler/publication-day-ledger";
import { privateJson, readJsonBody } from "@/lib/security/mutation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NEWS_SITE =
  process.env.NEXT_PUBLIC_SITE_URL || "https://news.investwithraj.com";

interface RouteParams {
  params: Promise<{ id: string }>;
}

interface PublishRequest {
  expectedRevision?: unknown;
  expectedRecordVersion?: unknown;
  expectedContentHash?: unknown;
  mediaApprovalHash?: unknown;
  evidenceApprovalHash?: unknown;
  automatedMorningLane?: unknown;
  requiredPublishedDubaiDate?: unknown;
}

function validHash(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  const auth = await authorize(req);
  if (!auth.ok) return privateJson({ error: auth.message }, auth.status ?? 401);
  const { id } = await params;
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(id)) {
    return privateJson({ error: "Invalid draft ID." }, 400);
  }
  try {
    const draft = await getDraft(id);
    const assessment = draft
      ? assessDraft(draft, { autoPublicationAt: new Date() })
      : null;
    const blockers: string[] = [];
    const storageBackend = getStorageBackend();
    if (!githubConfigured()) blockers.push("github-not-configured");
    if (process.env.NODE_ENV === "production" && storageBackend !== "vercel-kv") {
      blockers.push("durable-storage-not-configured");
    }
    if (!draft) blockers.push("draft-not-found");
    if (draft?.publication?.state === "publishing") {
      blockers.push("publication-already-in-progress");
    }
    if (assessment?.verdict === "manual") {
      blockers.push("evidence-or-validator-hold");
    }
    const duplicateHold = draft
      ? findRecentLiveArticleDuplicate(draft.article, NEWS_ARTICLES)
      : null;
    if (duplicateHold) blockers.push("recent-live-duplicate");
    return privateJson({
      ok: blockers.length === 0,
      capability: {
        githubPublicationConfigured: githubConfigured(),
        durableStorageBackend: storageBackend,
        draftFound: Boolean(draft),
        evidenceLane: assessment?.evidenceLane ?? null,
        requiredPublisherCount: assessment?.requiredPublisherCount ?? null,
        automatedEvidenceReady: assessment?.verdict === "auto-approve",
        publicationState: draft?.publication?.state ?? "not-started",
      },
      duplicateHold,
      blockers,
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    return privateJson(
      {
        error: "Publication capability check could not read the draft store.",
        diagnostic: publicationFailureDiagnostic(error, "draft-read"),
      },
      503,
    );
  }
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const auth = await authorizeMutation(req);
  if (!auth.ok) {
    return privateJson({ error: auth.message }, auth.status ?? 401);
  }
  const automated = auth.credential === "server-secret";
  const autoPublicationAt = automated ? new Date() : undefined;
  if (!githubConfigured()) {
    return privateJson(
      {
        error: "Publishing is disabled because GitHub is not configured.",
        diagnostic: publicationFailureDiagnostic(
          new Error("GitHub is not configured."),
          "github-commit",
        ),
      },
      503,
    );
  }

  const { id } = await params;
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(id)) {
    return privateJson({ error: "Invalid draft ID." }, 400);
  }
  const parsed = await readJsonBody<PublishRequest>(req, {
    maxBytes: 4_096,
    allowEmpty: automated,
  });
  if (!parsed.ok) return parsed.response;
  const body = parsed.value;
  if (
    !automated &&
    (body.automatedMorningLane !== undefined ||
      body.requiredPublishedDubaiDate !== undefined)
  ) {
    return privateJson(
      { error: "Automated morning publication fields require server authentication." },
      400,
    );
  }
  if (
    automated &&
    body.automatedMorningLane !== undefined &&
    typeof body.automatedMorningLane !== "boolean"
  ) {
    return privateJson(
      { error: "automatedMorningLane must be a boolean when supplied." },
      400,
    );
  }
  let automatedMorningDate: string | null = null;
  if (automated && body.automatedMorningLane === true) {
    if (typeof body.requiredPublishedDubaiDate !== "string") {
      return privateJson(
        {
          error:
            "The automated morning lane requires requiredPublishedDubaiDate.",
        },
        400,
      );
    }
    try {
      automatedMorningDate = validatedDubaiMorningDate(
        body.requiredPublishedDubaiDate,
        autoPublicationAt,
      );
    } catch {
      return privateJson(
        {
          error:
            "The automated morning publication date must match the current Dubai calendar date.",
        },
        409,
      );
    }
  } else if (body.requiredPublishedDubaiDate !== undefined) {
    return privateJson(
      {
        error:
          "requiredPublishedDubaiDate is valid only for the automated morning lane.",
      },
      400,
    );
  }
  if (!automated && (
    typeof body.expectedRevision !== "number" ||
    !Number.isSafeInteger(body.expectedRevision) ||
    body.expectedRevision < 1 ||
    typeof body.expectedRecordVersion !== "number" ||
    !Number.isSafeInteger(body.expectedRecordVersion) ||
    body.expectedRecordVersion < 1 ||
    !validHash(body.expectedContentHash) ||
    !validHash(body.mediaApprovalHash) ||
    !validHash(body.evidenceApprovalHash)
  )) {
    return privateJson(
      {
        error:
          "The exact revision, record version, content hash and approval hashes are required.",
      },
      400,
    );
  }

  let stage: PublicationStage = "draft-read";
  let automatedDay:
    | {
        ledger: KvAutomatedPublicationDayLedger;
        identity: AutomatedPublicationDayIdentity;
        token: string;
      }
    | undefined;
  let automatedCommitBoundaryCrossed = false;
  try {
    let draft = await getDraft(id);
    if (!draft) return privateJson({ error: "Draft not found." }, 404);
    if (automatedMorningDate) {
      let articleDubaiDate: string;
      try {
        articleDubaiDate = dubaiCalendarDate(draft.article.publishedAt);
      } catch {
        return privateJson(
          { error: "The automated draft has an invalid publication timestamp." },
          422,
        );
      }
      if (articleDubaiDate !== automatedMorningDate) {
        return privateJson(
          {
            error:
              "The automated draft does not belong to the required Dubai publication date.",
          },
          409,
        );
      }
    }
    await assertPublishedCorrectionLineage(draft);
    const existingPublication = draft.publication;
    if (
      existingPublication?.state === "committed" &&
      existingPublication.commitSha &&
      existingPublication.url
    ) {
      const currentEvidence = reassessPublicationEvidence(draft);
      if (!currentEvidence) {
        return privateJson(
          {
            error:
              "The committed publication uses an obsolete or invalid evidence policy and requires manual review.",
          },
          409,
        );
      }
      if (
        !automated &&
        (existingPublication.revision !== body.expectedRevision ||
          existingPublication.contentHash !== body.expectedContentHash ||
          existingPublication.mediaApprovalHash !== body.mediaApprovalHash ||
          existingPublication.evidenceApprovalHash !== body.evidenceApprovalHash)
      ) {
        return privateJson(
          { error: "Draft changed; reload before publishing." },
          409,
        );
      }
      return privateJson(
        {
          ok: true,
          slug: draft.article.slug,
          url: existingPublication.url,
          commitSha: existingPublication.commitSha,
          claimId: existingPublication.claimId,
          publicationState: "committed-awaiting-deployment-verification",
          idempotent: true,
        },
        202,
      );
    }
    if (!automated && (
      draft.revision !== body.expectedRevision ||
      draft.recordVersion !== body.expectedRecordVersion ||
      draft.contentHash !== body.expectedContentHash
    )) {
      return privateJson(
        { error: "Draft changed; reload before publishing." },
        409,
      );
    }

    if (automated) {
      const fetchedEvidenceUrls = new Set(
        (draft.provenance.fetchedEvidence ?? []).map((record) => record.url),
      );
      const evidenceBoundCitations = draft.article.citations.filter(
        (citation) => fetchedEvidenceUrls.has(citation.url),
      );
      if (evidenceBoundCitations.length !== draft.article.citations.length) {
        const revisedArticle = {
          ...draft.article,
          citations: evidenceBoundCitations,
        };
        const revised = await updateReviewedDraft(
          id,
          { article: revisedArticle },
          {
            revision: draft.revision,
            recordVersion: draft.recordVersion,
            contentHash: draft.contentHash,
          },
        );
        if (!revised) return privateJson({ error: "Draft not found." }, 404);

        const revisedAssessment = assessDraft(revised, { autoPublicationAt });
        if (revisedAssessment.verdict !== "auto-approve") {
          return privateJson(
            {
              error:
                "Publication is held after removing citations without independently fetched evidence.",
              reasons: revisedAssessment.reasons,
            },
            422,
          );
        }
        draft = revised;
      }
    }

    stage = "integrity-validation";
    const articleResult = validateDraftArticleShape(draft.article);
    if (!articleResult.ok) {
      return privateJson({ error: articleResult.error }, 422);
    }
    const provenanceResult = validateProvenanceShape(
      draft.provenance,
      draft.article.citations.map((citation) => citation.url),
    );
    if (!provenanceResult.ok) {
      return privateJson({ error: provenanceResult.error }, 422);
    }
    if (
      draftContentHash(
        articleResult.article,
        provenanceResult.provenance,
      ) !== draft.contentHash
    ) {
      return privateJson(
        { error: "Stored draft content does not match its integrity hash." },
        409,
      );
    }

    const duplicateHold = findRecentLiveArticleDuplicate(
      articleResult.article,
      NEWS_ARTICLES,
    );
    if (duplicateHold) {
      return privateJson(
        {
          error: duplicateHold.reason,
          duplicate: duplicateHold,
        },
        409,
      );
    }

    const validator = validateArticle(articleResult.article);
    if (!validator.ok) {
      return privateJson(
        {
          error:
            "Draft fails the current voice/validator gates; fix it before publishing.",
          failures: validator.failures.filter(
            (failure) => failure.severity === "block",
          ),
        },
        422,
      );
    }

    stage = "evidence-validation";
    const assessment = assessDraft(
      { ...draft, validator },
      { autoPublicationAt },
    );
    if (assessment.verdict !== "auto-approve") {
      return privateJson(
        {
          error:
            "Publication is held until the independently fetched evidence contract passes.",
          reasons: assessment.reasons,
        },
        422,
      );
    }

    if (automated) {
      const citationUrls = [
        ...new Set(draft.article.citations.map((citation) => citation.url)),
      ];
      const preparedSources = draft.verifiedSources ?? [];
      const alreadyPrepared =
        citationUrls.length === preparedSources.length &&
        citationUrls.every((url) => preparedSources.includes(url)) &&
        // An old-policy ledger is not prepared. After the current assessment
        // above passes, the existing CAS review write may mint a current one.
        Boolean(reassessEvidenceApproval(draft));
      if (!alreadyPrepared) {
        const prepared = await updateReviewedDraft(
          id,
          { verifiedSources: citationUrls },
          {
            revision: draft.revision,
            recordVersion: draft.recordVersion,
            contentHash: draft.contentHash,
          },
          { evidenceReviewer: "deterministic-auto-publisher" },
        );
        if (!prepared) return privateJson({ error: "Draft not found." }, 404);
        draft = prepared;
      }
    }

    const verified = new Set(draft.verifiedSources ?? []);
    const unverifiedSources = draft.article.citations
      .map((citation) => citation.url)
      .filter((url) => !verified.has(url));
    if (unverifiedSources.length > 0) {
      return privateJson(
        {
          error:
            "Every cited source must be bound to independently fetched evidence before publication.",
          unverifiedSources,
        },
        422,
      );
    }
    if (!draft.evidenceApproval) {
      return privateJson(
        { error: "The evidence approval ledger is missing." },
        422,
      );
    }
    const recomputedEvidence = reassessEvidenceApproval(draft);
    if (
      !recomputedEvidence ||
      recomputedEvidence.hash !== draft.evidenceApproval.hash ||
      (!automated && draft.evidenceApproval.hash !== body.evidenceApprovalHash)
    ) {
      return privateJson(
        { error: "The evidence approval ledger is stale or invalid." },
        409,
      );
    }

    try {
      assertRequiredCuratedMediaApproval(draft);
    } catch (error) {
      if (error instanceof CuratedMediaReuseError) {
        return privateJson({ error: error.message }, error.status);
      }
      throw error;
    }
    stage = "media-validation";
    if (!draft.mediaApproval && !automated) {
      return privateJson(
        { error: "The immutable UHD media approval ledger is missing." },
        422,
      );
    }
    let storedMediaHash = WITHHELD_MEDIA_APPROVAL_HASH;
    if (draft.mediaApproval) {
      const { hash, ...mediaRecord } = draft.mediaApproval;
      storedMediaHash = hash;
      if (
        mediaApprovalHash(mediaRecord) !== hash ||
        (!automated && hash !== body.mediaApprovalHash) ||
        draft.mediaApproval.revision !== draft.revision ||
        draft.mediaApproval.contentHash !== draft.contentHash
      ) {
        return privateJson(
          { error: "The UHD media approval ledger is stale or invalid." },
          409,
        );
      }
    }

    if (automatedMorningDate) {
      const identity: AutomatedPublicationDayIdentity = {
        morningDate: automatedMorningDate,
        draftId: draft.id,
        revision: draft.revision,
        contentHash: draft.contentHash,
      };
      const ledger = new KvAutomatedPublicationDayLedger(process.env);
      const dayClaim = await ledger.claim(identity);
      if (dayClaim.status === "unavailable") {
        return privateJson(
          {
            error:
              "Automated publication is disabled because its durable Dubai-day ledger is unavailable.",
          },
          503,
        );
      }
      if (dayClaim.status === "conflict") {
        return privateJson(
          {
            error:
              "An automated morning publication is already reserved for this Dubai date.",
          },
          409,
        );
      }
      if (dayClaim.status === "busy") {
        return privateJson(
          {
            error:
              "This exact automated morning publication already has an active owner.",
          },
          409,
        );
      }
      if (dayClaim.status === "completed") {
        return privateJson(
          {
            error:
              "This automated morning publication is already complete for the Dubai date.",
          },
          409,
        );
      }
      automatedDay = { ledger, identity, token: dayClaim.token };
    }

    stage = "publication-claim";
    const claim = await claimDraftPublication(id, {
      revision: draft.revision,
      recordVersion: draft.recordVersion,
      contentHash: draft.contentHash,
      mediaApprovalHash: storedMediaHash,
      evidenceApprovalHash: draft.evidenceApproval.hash,
    });
    if (!claim) return privateJson({ error: "Draft not found." }, 404);
    if (!claim.acquired) {
      const existing = claim.draft.publication;
      const claimedEvidence = reassessPublicationEvidence(claim.draft);
      if (
        claimedEvidence &&
        existing?.state === "committed" &&
        existing.commitSha &&
        existing.url
      ) {
        let automatedDayCompleted: boolean | null = null;
        if (automatedDay) {
          const idempotentCommitStart =
            await automatedDay.ledger.markCommitStarted(
              automatedDay.identity,
              automatedDay.token,
            );
          if (idempotentCommitStart !== "started") {
            return privateJson(
              {
                error:
                  idempotentCommitStart === "unavailable"
                    ? "Automated publication stopped because its durable Dubai-day commit barrier is unavailable."
                    : "Automated publication stopped because its Dubai-day reservation ownership expired.",
              },
              idempotentCommitStart === "unavailable" ? 503 : 409,
            );
          }
          // The exact immutable draft is already committed. Close this day's
          // reservation with that real receipt before returning idempotently.
          automatedCommitBoundaryCrossed = true;
          automatedDayCompleted = await automatedDay.ledger.complete(
            automatedDay.identity,
            automatedDay.token,
            {
              draftId: claim.draft.id,
              slug: claim.draft.article.slug,
              claimId: existing.claimId,
              commitSha: existing.commitSha,
              url: existing.url,
              completedAt: new Date().toISOString(),
            },
          );
        }
        return privateJson({
          ok: true,
          slug: draft.article.slug,
          url: existing.url,
          commitSha: existing.commitSha,
          claimId: existing.claimId,
          publicationState: "committed-awaiting-deployment-verification",
          idempotent: true,
          automatedMorningPublication: automatedDay
            ? {
                date: automatedDay.identity.morningDate,
                state: automatedDayCompleted
                  ? "completed"
                  : "commit-started",
              }
            : null,
        });
      }
      const startedAt = Date.parse(existing?.startedAt ?? "");
      if (
        existing?.state !== "publishing" ||
        !Number.isFinite(startedAt) ||
        Date.now() - startedAt < 5 * 60 * 1_000
      ) {
        return privateJson(
          { error: "This exact revision already has a publication in progress." },
          409,
        );
      }
      // A stale publishing claim can be resumed because the Git operation is
      // content-idempotent and recovers the original content commit.
    }

    const publication = claim.draft.publication;
    if (!publication) {
      throw new DraftConflictError("Publication claim was not persisted.");
    }
    const slug = draft.article.slug;
    if (automatedDay) {
      const commitStart = await automatedDay.ledger.markCommitStarted(
        automatedDay.identity,
        automatedDay.token,
      );
      if (commitStart !== "started") {
        return privateJson(
          {
            error:
              commitStart === "unavailable"
                ? "Automated publication stopped because its durable Dubai-day commit barrier is unavailable."
                : "Automated publication stopped because its Dubai-day reservation ownership expired.",
          },
          commitStart === "unavailable" ? 503 : 409,
        );
      }
      // Never release the day after this point. A GitHub error can be an
      // ambiguous response to a commit that actually succeeded.
      automatedCommitBoundaryCrossed = true;
    }
    stage = "github-commit";
    const commitSha = await publishArticleCommit(
      slug,
      draft.article,
      draft.mediaApproval ?? null,
      draft.contentHash,
      draft.correctionOf,
    );
    const url = `${NEWS_SITE}/news/${slug}`;
    stage = "receipt-recording";
    await recordDraftPublicationCommit(
      id,
      publication.claimId,
      commitSha,
      url,
    );
    const automatedDayCompleted = automatedDay
      ? await automatedDay.ledger.complete(
          automatedDay.identity,
          automatedDay.token,
          {
            draftId: draft.id,
            slug,
            claimId: publication.claimId,
            commitSha,
            url,
            completedAt: new Date().toISOString(),
          },
        )
      : null;

    return privateJson(
      {
        ok: true,
        slug,
        url,
        commitSha,
        claimId: publication.claimId,
        publicationState: "committed-awaiting-deployment-verification",
        automatedMorningPublication: automatedDay
          ? {
              date: automatedDay.identity.morningDate,
              state: automatedDayCompleted ? "completed" : "commit-started",
            }
          : null,
        searchSubmission: {
          state: "pending-explicit-operation",
          message:
            "No indexing or distribution call was made by the publish request.",
        },
      },
      202,
    );
  } catch (error) {
    if (error instanceof NewsDuplicateHoldError) {
      return privateJson(
        {
          error: error.hold.reason,
          duplicate: error.hold,
        },
        409,
      );
    }
    if (error instanceof DraftConflictError) {
      return privateJson({ error: error.message }, 409);
    }
    const diagnostic = publicationFailureDiagnostic(error, stage);
    return privateJson(
      {
        error: `Publication failed during ${stage}.`,
        diagnostic,
      },
      diagnostic.code === "draft-storage-unavailable" ? 503 : 502,
    );
  } finally {
    if (automatedDay && !automatedCommitBoundaryCrossed) {
      await automatedDay.ledger.releaseBeforeCommit(
        automatedDay.identity,
        automatedDay.token,
        `pre-commit-${stage}`,
      );
    }
  }
}
