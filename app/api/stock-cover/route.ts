// Stock cover-image fetcher — replaces /api/cover-image's Higgsfield call.
// Searches Unsplash + Pexels + Wikimedia + Pixabay for a real, license-clean
// photo matching the article's developer / area / category.
//
// GET  /api/stock-cover?slug=2026-05-26-dld-21b-week
//        → returns top match for that article's auto-derived query
// GET  /api/stock-cover?q=Hudayriyat+Island+aerial
//        → arbitrary query
// POST /api/stock-cover with the server credential header, body: { slug }
//        → fetches + persists to public/news/<slug>-hero.jpg
//          (cron-fired; auto-cover image on every commit)

import { NextRequest } from "next/server";
import { findBestStockImage } from "@/lib/stock/providers";
import { buildQueryForArticle } from "@/lib/stock/query-builder";
import { getNewsBySlug } from "@/content/news";
import { explicitlyEnabled } from "@/lib/operations/features";
import {
  authorizeServerMutation,
  privateJson,
  publicStatusJson,
  readJsonBody,
} from "@/lib/security/mutation";

export const dynamic = "force-dynamic";

export function GET() {
  return publicStatusJson({
    name: "Real editorial-media discovery",
    mutationMethod: "POST",
    available: explicitlyEnabled("ENABLE_EDITORIAL_MEDIA_DISCOVERY"),
    productionPolicy:
      "candidate discovery only; every asset stays withheld until source, rights, subject and dimensions are reviewed",
  });
}

export async function POST(request: NextRequest) {
  const auth = authorizeServerMutation(request);
  if (!auth.ok) return auth.response;
  if (!explicitlyEnabled("ENABLE_EDITORIAL_MEDIA_DISCOVERY")) {
    return privateJson(
      { error: "Editorial-media discovery is disabled." },
      503,
    );
  }

  const parsed = await readJsonBody<{ slug?: unknown; q?: unknown }>(request, {
    maxBytes: 16_384,
  });
  if (!parsed.ok) return parsed.response;
  const body = parsed.value;

  let query = typeof body.q === "string" ? body.q : "";
  const slug = typeof body.slug === "string" ? body.slug : "";

  if (slug && !query) {
    const article = getNewsBySlug(slug);
    if (!article) {
      return privateJson({ error: `Article ${slug} not found` }, 404);
    }
    query = buildQueryForArticle(article);
  }
  if (!query) {
    return privateJson({ error: "Need a valid article slug or query." }, 400);
  }
  if (query.length > 500) {
    return privateJson({ error: "Query is too long." }, 400);
  }

  const best = await findBestStockImage({
    query,
    orientation: "landscape",
    minWidth: 3840,
    allowSynthetic: false,
  });

  if (!best) {
    return privateJson(
      { ok: false, message: `No stock image found for "${query}"` },
      404,
    );
  }

  return privateJson({
    ok: true,
    slug: slug || null,
    query,
    candidate: best,
    approvedForEditorialUse: false,
    requiredNextStep:
      "Download an authorised source derivative, record rights and provenance, verify the depicted subject and approve it in the media contract.",
    timestamp: new Date().toISOString(),
  });
}
