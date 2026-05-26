// Stock cover-image fetcher — replaces /api/cover-image's Higgsfield call.
// Searches Unsplash + Pexels + Wikimedia + Pixabay for a real, license-clean
// photo matching the article's developer / area / category.
//
// GET  /api/stock-cover?slug=2026-05-26-dld-21b-week
//        → returns top match for that article's auto-derived query
// GET  /api/stock-cover?q=Hudayriyat+Island+aerial
//        → arbitrary query
// POST /api/stock-cover?secret=...  body: { slug }
//        → fetches + persists to public/news/<slug>-hero.jpg
//          (cron-fired; auto-cover image on every commit)

import { NextRequest, NextResponse } from "next/server";
import { searchStock, findBestStockImage } from "@/lib/stock/providers";
import { buildQueryForArticle } from "@/lib/stock/query-builder";
import { getNewsBySlug } from "@/content/news";

export const dynamic = "force-dynamic";

const SECRET = process.env.POST_PUBLISH_SECRET || "";

export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get("slug") || "";
  const q = request.nextUrl.searchParams.get("q") || "";

  let query = q;
  if (slug && !q) {
    const article = getNewsBySlug(slug);
    if (!article) {
      return NextResponse.json({ error: `Article ${slug} not found` }, { status: 404 });
    }
    query = buildQueryForArticle(article);
  }

  if (!query) {
    return NextResponse.json(
      { error: "Provide either ?slug=<article-slug> or ?q=<search-query>" },
      { status: 400 }
    );
  }

  const results = await searchStock({
    query,
    orientation: "landscape",
    minWidth: 1200,
    perPage: 5,
  });

  return NextResponse.json({
    ok: results.length > 0,
    query,
    count: results.length,
    results,
    timestamp: new Date().toISOString(),
  });
}

export async function POST(request: NextRequest) {
  if (!SECRET) {
    return NextResponse.json({ error: "Secret not set" }, { status: 503 });
  }
  if (request.nextUrl.searchParams.get("secret") !== SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { slug?: unknown; q?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  let query = typeof body.q === "string" ? body.q : "";
  const slug = typeof body.slug === "string" ? body.slug : "";

  if (slug && !query) {
    const article = getNewsBySlug(slug);
    if (!article) {
      return NextResponse.json({ error: `Article ${slug} not found` }, { status: 404 });
    }
    query = buildQueryForArticle(article);
  }
  if (!query) {
    return NextResponse.json({ error: "Need slug or q" }, { status: 400 });
  }

  const best = await findBestStockImage({
    query,
    orientation: "landscape",
    minWidth: 1200,
  });

  if (!best) {
    return NextResponse.json(
      { ok: false, message: `No stock image found for "${query}"` },
      { status: 404 }
    );
  }

  return NextResponse.json({
    ok: true,
    slug: slug || null,
    query,
    image: best,
    // The image URL is publicly hostable directly — no need to download/proxy.
    // Article hero just sets heroImage.src = image.url + credit = image.credit
    // The cron picks this up + commits the article with the URL embedded.
    timestamp: new Date().toISOString(),
  });
}
