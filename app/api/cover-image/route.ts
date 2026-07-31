// Non-production synthetic-cover diagnostic.
// Auth-gated and disabled by default. It is never an editorial media source.
//
// POST /api/cover-image with the server credential header
// body: { slug, prompt? }  (prompt auto-built from article if not provided)
// → returns Higgsfield URL.

import { NextRequest } from "next/server";
import {
  generateImage,
  buildArticleCoverPrompt,
  isHiggsfieldConfigured,
} from "@/lib/ai/higgsfield";
import { getNewsBySlug } from "@/content/news";
import {
  authorizeServerMutation,
  privateJson,
  publicStatusJson,
  readJsonBody,
} from "@/lib/security/mutation";

export const dynamic = "force-dynamic";

const SYNTHETIC_COVERS_ENABLED =
  process.env.NODE_ENV !== "production" &&
  process.env.ALLOW_SYNTHETIC_COVERS === "true";

export async function POST(request: NextRequest) {
  const auth = authorizeServerMutation(request);
  if (!auth.ok) return auth.response;
  if (!SYNTHETIC_COVERS_ENABLED) {
    return privateJson(
      {
        error:
          "Synthetic editorial covers are disabled. Use the verified real-media review workflow.",
      },
      410,
    );
  }

  if (!isHiggsfieldConfigured()) {
    return privateJson(
      {
        ok: false,
        message: "Higgsfield is not configured.",
      },
      503,
    );
  }

  const parsed = await readJsonBody<{ slug?: unknown; prompt?: unknown }>(
    request,
    { maxBytes: 16_384 },
  );
  if (!parsed.ok) return parsed.response;
  const body = parsed.value;

  const slug = typeof body.slug === "string" ? body.slug : "";
  let prompt = typeof body.prompt === "string" ? body.prompt : "";

  if (!prompt && slug) {
    const article = getNewsBySlug(slug);
    if (!article) {
      return privateJson({ error: `Article ${slug} not found` }, 404);
    }
    prompt = buildArticleCoverPrompt({
      category: article.category,
      market: article.market,
      title: article.title,
    });
  }
  if (!prompt) {
    return privateJson(
      { error: "Provide either slug (to auto-build prompt) or explicit prompt" },
      400,
    );
  }
  if (prompt.length > 2_000) {
    return privateJson({ error: "Prompt is too long." }, 400);
  }

  const result = await generateImage({ prompt, aspectRatio: "16:9" });
  if (!result.ok) {
    return privateJson({ ok: false, error: result.error }, 502);
  }

  return privateJson({
    ok: true,
    slug: slug || null,
    prompt,
    url: result.url,
    credits: result.credits,
    approvedForEditorialUse: false,
    warning:
      "Diagnostic output cannot be used as news media or represent a real property, project or event.",
    timestamp: new Date().toISOString(),
  });
}

export function GET() {
  return publicStatusJson({
    name: "Synthetic cover diagnostic",
    mutationMethod: "POST",
    available: SYNTHETIC_COVERS_ENABLED && isHiggsfieldConfigured(),
    productionPolicy:
      "disabled; news covers require real, rights-recorded editorial media",
  });
}
