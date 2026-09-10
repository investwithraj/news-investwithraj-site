import { NextRequest } from "next/server";

import { authorizeMutation } from "@/lib/news-review/auth";
import {
  CuratedMediaReuseError,
  parseCuratedMediaReuseRequest,
  PRESTIGE_ONE_CONTEXT_MEDIA,
  reuseApprovedCuratedMedia,
} from "@/lib/news-review/curated-media";
import { githubConfigured, inspectEditorialMedia } from "@/lib/news-review/github";
import { DraftConflictError, getDraft, setMediaApproval } from "@/lib/news-review/storage";
import { privateJson, readJsonBody } from "@/lib/security/mutation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Server-only reuse of one existing owner approval; not a media approval API. */
export async function POST(request: NextRequest, { params }: {
  params: Promise<{ id: string }>;
}) {
  const auth = await authorizeMutation(request);
  if (!auth.ok) return privateJson({ error: auth.message }, auth.status);
  if (auth.credential !== "server-secret") {
    return privateJson({ error: "Curated media reuse requires the protected pipeline credential." }, 403);
  }
  const origin = request.headers.get("origin");
  if ((origin !== null && origin !== request.nextUrl.origin) || request.nextUrl.search) {
    return privateJson({ error: "Unexpected origin or query parameters." }, 403);
  }
  const parsed = await readJsonBody<unknown>(request, { maxBytes: 2_048 });
  if (!parsed.ok) return parsed.response;
  try {
    const body = parseCuratedMediaReuseRequest(parsed.value);
    const { id } = await params;
    if (id !== PRESTIGE_ONE_CONTEXT_MEDIA.draftId) {
      return privateJson({ error: "This draft has no owner-approved media reuse." }, 403);
    }
    if (!githubConfigured()) {
      return privateJson({ error: "GitHub media inspection is unavailable." }, 503);
    }
    const draft = await reuseApprovedCuratedMedia(id, body, {
      getDraft,
      inspectEditorialMedia,
      setMediaApproval,
    });
    return privateJson({
      ok: true,
      mediaApproval: draft.mediaApproval,
      revision: draft.revision,
      recordVersion: draft.recordVersion,
      contentHash: draft.contentHash,
    });
  } catch (error) {
    if (error instanceof CuratedMediaReuseError) {
      return privateJson({ error: error.message }, error.status);
    }
    if (error instanceof DraftConflictError) {
      return privateJson({ error: "Draft changed during media reuse." }, 409);
    }
    // Upstream errors may contain private repository or transport details.
    return privateJson({ error: "The approved media could not be inspected or recorded." }, 502);
  }
}
