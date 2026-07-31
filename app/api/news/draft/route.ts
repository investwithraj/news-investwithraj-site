// News review drafts — create (POST) + list (GET).
//
// POST is called by the pipeline (server-secret header) or the cockpit
// (HttpOnly review session) to stage a drafted article into KV. It NEVER publishes — the
// article only goes live via the /publish route after Raj approves.

import { NextRequest } from "next/server";
import { getNewsBySlug } from "@/content/news";
import { authorize, authorizeMutation } from "@/lib/news-review/auth";
import {
  addDraft,
  addReservedDraft,
  DraftCollisionError,
  DraftConflictError,
  getAllDrafts,
  getStorageBackend,
} from "@/lib/news-review/storage";
import {
  validateDraftArticleShape,
  validateProvenanceShape,
} from "@/lib/news-review/integrity";
import type { NewsDraftInput } from "@/lib/news-review/types";
import { privateJson, readJsonBody } from "@/lib/security/mutation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await authorize(req);
  if (!auth.ok) {
    return privateJson({ error: auth.message }, auth.status);
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
