import { NextRequest } from "next/server";

import aldarOffplanMortgage from "@/ops/news-corrections/aldar-offplan-mortgage-2026-09-06.json";
import {
  stagePublishedCorrection,
  type PublishedCorrectionManifest,
} from "@/lib/news-review/correction";
import {
  authorizeServerMutation,
  privateJson,
  readJsonBody,
} from "@/lib/security/mutation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORRECTIONS: Record<string, PublishedCorrectionManifest> = {
  "aldar-offplan-mortgage-2026-09-06":
    aldarOffplanMortgage as unknown as PublishedCorrectionManifest,
};

export async function POST(request: NextRequest) {
  const auth = authorizeServerMutation(request);
  if (!auth.ok) return auth.response;

  const parsed = await readJsonBody<{ correctionKey?: unknown }>(request, {
    maxBytes: 1_024,
  });
  if (!parsed.ok) return parsed.response;
  const correctionKey = parsed.value.correctionKey;
  if (
    typeof correctionKey !== "string" ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(correctionKey) ||
    correctionKey.length > 80
  ) {
    return privateJson({ error: "A valid correction key is required." }, 400);
  }
  const manifest = CORRECTIONS[correctionKey];
  if (!manifest) {
    return privateJson({ error: "Correction manifest not found." }, 404);
  }

  try {
    const result = await stagePublishedCorrection(manifest);
    return privateJson({
      ok: true,
      correctionKey,
      state: result.state,
      draftId: result.draft.id,
      slug: result.draft.article.slug,
      contentHash: result.draft.contentHash,
      publication:
        result.state === "completed"
          ? {
              claimId: result.draft.publication?.claimId,
              commitSha: result.draft.publication?.commitSha,
              url: result.draft.publication?.url,
            }
          : undefined,
    });
  } catch (error) {
    return privateJson(
      {
        error:
          error instanceof Error
            ? error.message
            : "Correction could not be staged.",
      },
      409,
    );
  }
}
