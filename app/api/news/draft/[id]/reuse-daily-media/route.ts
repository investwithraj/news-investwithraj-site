import { NextRequest } from "next/server";

import { authorizeMutation } from "@/lib/news-review/auth";
import { assertDailyMediaDraftId, DailyMediaReuseError, parseDailyMediaReuseRequest, reuseApprovedDailyMedia } from "@/lib/news-review/daily-media";
import { githubConfigured, inspectEditorialMedia } from "@/lib/news-review/github";
import { DailyMediaGitError, ensureApprovedDailyMediaCover } from "@/lib/news-review/github-daily-media";
import { DraftConflictError, getDraft, setMediaApproval } from "@/lib/news-review/storage";
import { privateJson, readJsonBody } from "@/lib/security/mutation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Protected reuse of a catalogue owner approval; never a general upload API. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeMutation(request);
  if (!auth.ok) return privateJson({ error: auth.message }, auth.status);
  if (auth.credential !== "server-secret") {
    return privateJson({ error: "Daily media reuse requires the protected pipeline credential." }, 403);
  }
  const origin = request.headers.get("origin");
  if ((origin !== null && origin !== request.nextUrl.origin) || request.nextUrl.search) {
    return privateJson({ error: "Unexpected origin or query parameters." }, 403);
  }
  const parsed = await readJsonBody<unknown>(request, { maxBytes: 2_048 });
  if (!parsed.ok) return parsed.response;
  try {
    const body = parseDailyMediaReuseRequest(parsed.value);
    const { id } = await params;
    assertDailyMediaDraftId(id);
    if (!githubConfigured()) return privateJson({ error: "GitHub media reuse is unavailable." }, 503);
    const draft = await reuseApprovedDailyMedia(id, body, {
      getDraft,
      ensureApprovedDailyMediaCover,
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
    if (error instanceof DailyMediaReuseError) return privateJson({ error: error.message }, error.status);
    if (error instanceof DraftConflictError) return privateJson({ error: "Draft changed during media reuse." }, 409);
    if (error instanceof DailyMediaGitError && [409, 422, 503].includes(error.status)) {
      return privateJson({ error: error.message }, error.status);
    }
    return privateJson({ error: "The approved daily image could not be attached or recorded." }, 502);
  }
}
