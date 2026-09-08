// News review drafts — create (POST) + list (GET).
//
// POST is called by the pipeline (server-secret header) or the cockpit
// (HttpOnly review session) to stage a drafted article into KV. It NEVER publishes — the
// article only goes live via the /publish route after Raj approves.

import { NextRequest } from "next/server";
import { getNewsBySlug, NEWS_ARTICLES } from "@/content/news";
import { authorize, authorizeMutation } from "@/lib/news-review/auth";
import {
  addDraft,
  addReservedDraft,
  DraftCollisionError,
  DraftConflictError,
  getAllDrafts,
  getStoredDraft,
  getStorageBackend,
} from "@/lib/news-review/storage";
import {
  validateDraftArticleShape,
  validateProvenanceShape,
} from "@/lib/news-review/integrity";
import type { NewsDraftInput } from "@/lib/news-review/types";
import { findRecentLiveArticleDuplicate } from "@/lib/news-review/duplicate-guard";
import { privateJson, readJsonBody } from "@/lib/security/mutation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DETERMINISTIC_DRAFT_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

export async function GET(req: NextRequest) {
  const auth = await authorize(req);
  if (!auth.ok) {
    return privateJson({ error: auth.message }, auth.status);
  }
  const requestedIds = req.nextUrl.searchParams.getAll("id");
  if (requestedIds.length > 0) {
    if (auth.credential !== "server-secret") {
      return privateJson(
        { error: "Exact draft lookup is available only to server automation." },
        403,
      );
    }
    if (
      requestedIds.length !== 1 ||
      [...req.nextUrl.searchParams.keys()].some((key) => key !== "id") ||
      !DETERMINISTIC_DRAFT_ID.test(requestedIds[0])
    ) {
      return privateJson({ error: "A valid exact draft ID is required." }, 400);
    }
    try {
      const draft = await getStoredDraft(requestedIds[0]);
      if (!draft) return privateJson({ error: "Draft not found." }, 404);
      return privateJson({ ok: true, draft });
    } catch {
      return privateJson({ error: "Draft storage is unavailable." }, 503);
    }
  }
  try {
    const drafts = await getAllDrafts();
    return privateJson({ ok: true, drafts, backend: getStorageBackend() });
  } catch {
    return privateJson({ error: "Draft storage is unavailable." }, 503);
  }
}

export async function POST(req: NextRequest) {
  const auth = await authorizeMutation(req);
  if (!auth.ok) {
    return privateJson({ error: auth.message }, auth.status);
  }

  const parsed = await readJsonBody<Partial<NewsDraftInput>>(req, {
    maxBytes: 196_608,
  });
  if (!parsed.ok) return parsed.response;
  const body = parsed.value;
  const articleResult = validateDraftArticleShape(body.article);
  if (!articleResult.ok) {
    return privateJson({ error: articleResult.error }, 400);
  }
  if (getNewsBySlug(articleResult.article.slug)) {
    return privateJson(
      { error: "A published article already occupies this slug." },
      409,
    );
  }
  const fallbackProvenance = {
    clusterId: `manual-${articleResult.article.slug}`,
    topic: articleResult.article.title,
    score: 0,
    scoreBreakdown: {
      uhnwRelevance: 0,
      sourceTier: 0,
      freshness: 0,
      rajAngle: 0,
    },
    sources: [],
  };
  const provenanceResult = validateProvenanceShape(
    body.provenance ??
      (auth.credential === "review-session"
        ? fallbackProvenance
        : undefined),
    articleResult.article.citations.map((citation) => citation.url),
  );
  if (!provenanceResult.ok) {
    return privateJson({ error: provenanceResult.error }, 400);
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
  if (
    body.reviewNote !== undefined &&
    (typeof body.reviewNote !== "string" || body.reviewNote.length > 4_000)
  ) {
    return privateJson({ error: "reviewNote is invalid." }, 400);
  }
  const reservationToken =
    typeof body.reservationToken === "string" &&
    /^[0-9a-f-]{36}$/i.test(body.reservationToken)
      ? body.reservationToken
      : "";
  const draftId =
    typeof body.draftId === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      body.draftId,
    )
      ? body.draftId
      : undefined;
  if (
    body.draftId !== undefined &&
    (auth.credential !== "server-secret" || !draftId)
  ) {
    return privateJson(
      { error: "A deterministic draft ID is invalid for this caller." },
      400,
    );
  }
  if (auth.credential === "server-secret" && !reservationToken) {
    return privateJson(
      {
        error:
          "Automation must acquire an atomic cluster reservation before staging.",
      },
      409,
    );
  }

  try {
    const input = {
      draftId,
      article: articleResult.article,
      provenance: provenanceResult.provenance,
      reviewNote: body.reviewNote,
    };
    const draft =
      auth.credential === "server-secret"
        ? await addReservedDraft({
            ...input,
            reservationToken,
          })
        : await addDraft(input);
    return privateJson({ ok: true, draft }, 201);
  } catch (error) {
    if (error instanceof DraftCollisionError) {
      return privateJson({ error: error.message }, 409);
    }
    if (error instanceof DraftConflictError) {
      return privateJson({ error: error.message }, 409);
    }
    return privateJson({ error: "Draft storage is unavailable." }, 503);
  }
}
