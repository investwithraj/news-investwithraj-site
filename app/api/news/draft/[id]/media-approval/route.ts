import { NextRequest } from "next/server";

import { authorizeMutation } from "@/lib/news-review/auth";
import {
  githubConfigured,
  inspectEditorialMedia,
} from "@/lib/news-review/github";
import { mediaApprovalHash } from "@/lib/news-review/integrity";
import {
  DraftConflictError,
  getDraft,
  setMediaApproval,
} from "@/lib/news-review/storage";
import type { MediaApprovalLedger } from "@/lib/news-review/types";
import { privateJson, readJsonBody } from "@/lib/security/mutation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

function validHttpsRecord(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 2_048) return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.hash &&
      (!url.port || url.port === "443")
    );
  } catch {
    return false;
  }
}

export async function POST(
  request: NextRequest,
  { params }: RouteParams,
) {
  const auth = await authorizeMutation(request);
  if (!auth.ok) return privateJson({ error: auth.message }, auth.status);
  if (auth.credential !== "review-session") {
    return privateJson(
      { error: "Only Raj's signed review session can approve media." },
      403,
    );
  }
  if (!githubConfigured()) {
    return privateJson({ error: "GitHub media inspection is unavailable." }, 503);
  }
  const parsed = await readJsonBody<{
    expectedRevision?: unknown;
    expectedRecordVersion?: unknown;
    expectedContentHash?: unknown;
    sourceUrl?: unknown;
    rightsStatus?: unknown;
    credit?: unknown;
  }>(request, { maxBytes: 8_192 });
  if (!parsed.ok) return parsed.response;
  const body = parsed.value;
  if (
    typeof body.expectedRevision !== "number" ||
    !Number.isSafeInteger(body.expectedRevision) ||
    typeof body.expectedRecordVersion !== "number" ||
    !Number.isSafeInteger(body.expectedRecordVersion) ||
    typeof body.expectedContentHash !== "string" ||
    !/^[a-f0-9]{64}$/.test(body.expectedContentHash) ||
    !validHttpsRecord(body.sourceUrl) ||
    typeof body.rightsStatus !== "string" ||
    body.rightsStatus.trim().length < 8 ||
    body.rightsStatus.length > 1_000 ||
    typeof body.credit !== "string" ||
    body.credit.trim().length < 2 ||
    body.credit.length > 300
  ) {
    return privateJson(
      {
        error:
          "Expected revision/hash, HTTPS source record, bounded rights basis and credit are required.",
      },
      400,
    );
  }

  const { id } = await params;
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(id)) {
    return privateJson({ error: "Invalid draft ID." }, 400);
  }
  try {
    const draft = await getDraft(id);
    if (!draft) return privateJson({ error: "Draft not found." }, 404);
    if (
      draft.revision !== body.expectedRevision ||
      draft.recordVersion !== body.expectedRecordVersion ||
      draft.contentHash !== body.expectedContentHash
    ) {
      return privateJson(
        { error: "Draft changed; reload before media approval." },
        409,
      );
    }
    const inspected = await inspectEditorialMedia(draft.article.slug);
    const recordWithoutHash: Omit<MediaApprovalLedger, "hash"> = {
      revision: draft.revision,
      contentHash: draft.contentHash,
      slug: draft.article.slug,
      ...inspected,
      sourceUrl: body.sourceUrl,
      rightsStatus: body.rightsStatus.trim(),
      credit: body.credit.trim(),
      reviewer: "raj-review-session",
      approvedAt: new Date().toISOString(),
    };
    const approval: MediaApprovalLedger = {
      ...recordWithoutHash,
      hash: mediaApprovalHash(recordWithoutHash),
    };
    const updated = await setMediaApproval(id, approval, {
      revision: draft.revision,
      recordVersion: draft.recordVersion,
      contentHash: draft.contentHash,
    });
    if (!updated) return privateJson({ error: "Draft not found." }, 404);
    return privateJson({
      ok: true,
      mediaApproval: updated.mediaApproval,
      revision: updated.revision,
      recordVersion: updated.recordVersion,
      contentHash: updated.contentHash,
    });
  } catch (error) {
    if (error instanceof DraftConflictError) {
      return privateJson({ error: error.message }, 409);
    }
    return privateJson(
      {
        error:
          error instanceof Error
            ? error.message
            : "Media approval is unavailable.",
      },
      502,
    );
  }
}
