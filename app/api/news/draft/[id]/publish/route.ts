// Human-reviewed publication endpoint.
//
// This route creates the one atomic Git commit for an approved article. It
// retains a durable "committed" draft record until a separate deployment
// verifier proves that exact commit is live.

import { NextRequest } from "next/server";

import { assessDraft } from "@/lib/news-review/auto-approve";
import { authorizeMutation } from "@/lib/news-review/auth";
import { githubConfigured, publishArticleCommit } from "@/lib/news-review/github";
import {
  draftContentHash,
  evidenceApprovalFor,
  mediaApprovalHash,
  validateDraftArticleShape,
  validateProvenanceShape,
  WITHHELD_MEDIA_APPROVAL_HASH,
} from "@/lib/news-review/integrity";
import {
  claimDraftPublication,
  DraftConflictError,
  getDraft,
  recordDraftPublicationCommit,
  updateReviewedDraft,
  validateArticle,
} from "@/lib/news-review/storage";
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
}

function validHash(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const auth = await authorizeMutation(req);
  if (!auth.ok) {
    return privateJson({ error: auth.message }, auth.status ?? 401);
  }
  const automated = auth.credential === "server-secret";
  if (!githubConfigured()) {
    return privateJson(
      { error: "Publishing is disabled because GitHub is not configured." },
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

  try {
    let draft = await getDraft(id);
    if (!draft) return privateJson({ error: "Draft not found." }, 404);
    const existingPublication = draft.publication;
    if (
      existingPublication?.state === "committed" &&
      existingPublication.commitSha &&
      existingPublication.url &&
      (automated ||
        (existingPublication.revision === body.expectedRevision &&
          existingPublication.contentHash === body.expectedContentHash &&
          existingPublication.mediaApprovalHash === body.mediaApprovalHash &&
          existingPublication.evidenceApprovalHash === body.evidenceApprovalHash))
    ) {
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

        const revisedAssessment = assessDraft(revised);
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

    const assessment = assessDraft({ ...draft, validator });
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
        Boolean(draft.evidenceApproval);
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
    const recomputedEvidence = evidenceApprovalFor(
      draft.revision,
      draft.contentHash,
      draft.verifiedSources ?? [],
      draft.provenance,
      draft.evidenceApproval.approvedAt,
      draft.evidenceApproval.reviewer,
    );
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
      if (
        existing?.state === "committed" &&
        existing.commitSha &&
        existing.url
      ) {
        return privateJson({
          ok: true,
          slug: draft.article.slug,
          url: existing.url,
          commitSha: existing.commitSha,
          claimId: existing.claimId,
          publicationState: "committed-awaiting-deployment-verification",
          idempotent: true,
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
    const commitSha = await publishArticleCommit(
      slug,
      draft.article,
      draft.mediaApproval ?? null,
      draft.contentHash,
    );
    const url = `${NEWS_SITE}/news/${slug}`;
    await recordDraftPublicationCommit(
      id,
      publication.claimId,
      commitSha,
      url,
    );

    return privateJson(
      {
        ok: true,
        slug,
        url,
        commitSha,
        claimId: publication.claimId,
        publicationState: "committed-awaiting-deployment-verification",
        searchSubmission: {
          state: "pending-explicit-operation",
          message:
            "No indexing or distribution call was made by the publish request.",
        },
      },
      202,
    );
  } catch (error) {
    if (error instanceof DraftConflictError) {
      return privateJson({ error: error.message }, 409);
    }
    return privateJson(
      {
        error:
          error instanceof Error
            ? error.message
            : "Publication could not be committed.",
      },
      502,
    );
  }
}
