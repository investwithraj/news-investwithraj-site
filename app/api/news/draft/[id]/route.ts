// Revision-aware human review mutations.
//
// Every edit/delete is bounded, shape-validated, and compare-and-swapped
// against the exact revision/version/hash the operator reviewed. A publication
// claim or concurrent browser session therefore cannot be overwritten.

import { NextRequest } from "next/server";
import { getNewsBySlug } from "@/content/news";
import { authorizeMutation } from "@/lib/news-review/auth";
import { validateDraftArticleShape } from "@/lib/news-review/integrity";
import {
  deleteReviewedDraft,
  DraftConflictError,
  getStoredDraft,
  updateReviewedDraft,
} from "@/lib/news-review/storage";
import type { DraftArticle } from "@/lib/news-review/types";
import { privateJson, readJsonBody } from "@/lib/security/mutation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

interface ExpectedDraft {
  expectedRevision?: unknown;
  expectedRecordVersion?: unknown;
  expectedContentHash?: unknown;
}

function parseExpected(body: ExpectedDraft):
  | { revision: number; recordVersion: number; contentHash: string }
  | null {
  if (
    !Number.isSafeInteger(body.expectedRevision) ||
    Number(body.expectedRevision) < 1 ||
    !Number.isSafeInteger(body.expectedRecordVersion) ||
    Number(body.expectedRecordVersion) < 1 ||
    typeof body.expectedContentHash !== "string" ||
    !/^[a-f0-9]{64}$/i.test(body.expectedContentHash)
  ) {
    return null;
  }
  return {
    revision: Number(body.expectedRevision),
    recordVersion: Number(body.expectedRecordVersion),
    contentHash: body.expectedContentHash.toLowerCase(),
  };
}

function validId(id: string): boolean {
  return id.length <= 128 && /^[A-Za-z0-9_-]+$/.test(id);
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const auth = await authorizeMutation(req);
  if (!auth.ok) return privateJson({ error: auth.message }, auth.status);
  if (auth.credential !== "review-session") {
    return privateJson(
      { error: "Only Raj's signed review session may edit drafts." },
      403,
    );
  }

  const { id } = await params;
  if (!validId(id)) return privateJson({ error: "Invalid draft ID." }, 400);

  const parsed = await readJsonBody<
    ExpectedDraft & {
      article?: unknown;
      reviewNote?: unknown;
      verifiedSources?: unknown;
    }
  >(req, { maxBytes: 196_608 });
  if (!parsed.ok) return parsed.response;
  const body = parsed.value;
  const allowedBodyKeys = new Set([
    "expectedRevision",
    "expectedRecordVersion",
    "expectedContentHash",
    "article",
    "reviewNote",
    "verifiedSources",
  ]);
  if (Object.keys(body).some((key) => !allowedBodyKeys.has(key))) {
    return privateJson({ error: "The request contains unsupported fields." }, 400);
  }
  const expected = parseExpected(body);
  if (!expected) {
    return privateJson(
      {
        error:
          "expectedRevision, expectedRecordVersion and expectedContentHash are required.",
      },
      400,
    );
  }
  if (body.article !== undefined && body.verifiedSources !== undefined) {
    return privateJson(
      { error: "Article edits and source verification are separate operations." },
      400,
    );
  }

  let current;
  try {
    current = await getStoredDraft(id);
  } catch {
    return privateJson({ error: "Draft storage is unavailable." }, 503);
  }
  if (!current) return privateJson({ error: "Draft not found." }, 404);

  const patch: Partial<
    Pick<DraftArticleContainer, "article" | "reviewNote" | "verifiedSources">
  > = {};

  if (body.article !== undefined) {
    const articleResult = validateDraftArticleShape(body.article);
    if (!articleResult.ok) {
      return privateJson({ error: articleResult.error }, 400);
    }
    const editableArticleKeys = new Set(["title", "subtitle", "body"]);
    const currentArticle = current.article as unknown as Record<string, unknown>;
    const nextArticle = articleResult.article as unknown as Record<string, unknown>;
    if (
      Object.keys(nextArticle).length !== Object.keys(currentArticle).length ||
      Object.keys(currentArticle).some(
        (key) =>
          !editableArticleKeys.has(key) &&
          JSON.stringify(nextArticle[key]) !== JSON.stringify(currentArticle[key]),
      )
    ) {
      return privateJson(
        {
          error:
            "Only title, subtitle and body may be edited here. Slug, citations, dates and media are immutable.",
        },
        400,
      );
    }
    const published = getNewsBySlug(articleResult.article.slug);
    if (published) {
      return privateJson(
        { error: "A published article already occupies this slug." },
        409,
      );
    }
    patch.article = articleResult.article;
  }

  if (body.reviewNote !== undefined) {
    if (typeof body.reviewNote !== "string" || body.reviewNote.length > 4_000) {
      return privateJson({ error: "reviewNote is invalid." }, 400);
    }
    patch.reviewNote = body.reviewNote.trim();
  }

  if (body.verifiedSources !== undefined) {
    if (
      auth.credential !== "review-session" ||
      !Array.isArray(body.verifiedSources)
    ) {
      return privateJson(
        { error: "Only Raj's review session can verify source URLs." },
        auth.credential === "review-session" ? 400 : 403,
      );
    }
    const citationUrls = new Set(
      current.article.citations.map((citation) => citation.url),
    );
    const evidenceUrls = new Set(
      (current.provenance.fetchedEvidence ?? []).map((record) => record.url),
    );
    const verifiedSources = [...new Set(body.verifiedSources)];
    if (
      verifiedSources.length > citationUrls.size ||
      verifiedSources.some(
        (url) =>
          typeof url !== "string" ||
          !citationUrls.has(url) ||
          !evidenceUrls.has(url),
      )
    ) {
      return privateJson(
        { error: "verifiedSources must be exact URLs cited by this revision." },
        400,
      );
    }
    patch.verifiedSources = verifiedSources as string[];
  }

  if (Object.keys(patch).length === 0) {
    return privateJson({ error: "No supported mutation was supplied." }, 400);
  }

  try {
    const draft = await updateReviewedDraft(id, patch, expected);
    if (!draft) return privateJson({ error: "Draft not found." }, 404);
    return privateJson({ ok: true, draft });
  } catch (error) {
    if (error instanceof DraftConflictError) {
      return privateJson({ error: error.message }, 409);
    }
    return privateJson({ error: "Draft storage is unavailable." }, 503);
  }
}

type DraftArticleContainer = {
  article: DraftArticle;
  reviewNote: string;
  verifiedSources: string[];
};

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const auth = await authorizeMutation(req);
  if (!auth.ok) return privateJson({ error: auth.message }, auth.status);
  if (auth.credential !== "review-session") {
    return privateJson(
      { error: "Only Raj's signed review session may reject drafts." },
      403,
    );
  }

  const { id } = await params;
  if (!validId(id)) return privateJson({ error: "Invalid draft ID." }, 400);
  const parsed = await readJsonBody<ExpectedDraft>(req, {
    maxBytes: 4_096,
  });
  if (!parsed.ok) return parsed.response;
  if (
    Object.keys(parsed.value).some(
      (key) =>
        ![
          "expectedRevision",
          "expectedRecordVersion",
          "expectedContentHash",
        ].includes(key),
    )
  ) {
    return privateJson({ error: "The request contains unsupported fields." }, 400);
  }
  const expected = parseExpected(parsed.value);
  if (!expected) {
    return privateJson(
      {
        error:
          "expectedRevision, expectedRecordVersion and expectedContentHash are required.",
      },
      400,
    );
  }

  try {
    const deleted = await deleteReviewedDraft(id, expected);
    if (!deleted) return privateJson({ error: "Draft not found." }, 404);
    return privateJson({ ok: true });
  } catch (error) {
    if (error instanceof DraftConflictError) {
      return privateJson({ error: error.message }, 409);
    }
    return privateJson({ error: "Draft storage is unavailable." }, 503);
  }
}
