// F14 — AI cover-image generation endpoint.
// Auth-gated (POST_PUBLISH_SECRET). Called by the daily-cron pipeline after
// new articles are committed and a hero image is missing.
//
// POST /api/cover-image?secret=...
// body: { slug, prompt? }  (prompt auto-built from article if not provided)
// → returns Higgsfield URL.

import { NextRequest, NextResponse } from "next/server";
import {
  generateImage,
  buildArticleCoverPrompt,
  isHiggsfieldConfigured,
} from "@/lib/ai/higgsfield";
import { getNewsBySlug } from "@/content/news";

export const dynamic = "force-dynamic";

const SECRET = process.env.POST_PUBLISH_SECRET || "";

export async function POST(request: NextRequest) {
  if (!SECRET) {
    return NextResponse.json({ error: "POST_PUBLISH_SECRET not set" }, { status: 503 });
  }
  const provided = request.nextUrl.searchParams.get("secret");
  if (provided !== SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isHiggsfieldConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Higgsfield not configured — set HIGGSFIELD_API_KEY on Vercel to enable.",
      },
      { status: 503 }
    );
  }

  let body: { slug?: unknown; prompt?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const slug = typeof body.slug === "string" ? body.slug : "";
  let prompt = typeof body.prompt === "string" ? body.prompt : "";

  if (!prompt && slug) {
    const article = getNewsBySlug(slug);
    if (!article) {
      return NextResponse.json({ error: `Article ${slug} not found` }, { status: 404 });
    }
    prompt = buildArticleCoverPrompt({
      category: article.category,
      market: article.market,
      title: article.title,
    });
  }
  if (!prompt) {
    return NextResponse.json(
      { error: "Provide either slug (to auto-build prompt) or explicit prompt" },
      { status: 400 }
    );
  }

  const result = await generateImage({ prompt, aspectRatio: "16:9" });
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 502 });
  }

  return NextResponse.json({
    ok: true,
    slug: slug || null,
    prompt,
    url: result.url,
    credits: result.credits,
    timestamp: new Date().toISOString(),
  });
}

export function GET() {
  return NextResponse.json({
    name: "AI cover-image generator (Higgsfield Soul)",
    method: "POST",
    auth: "?secret=<POST_PUBLISH_SECRET>",
    body: {
      slug: "string — article slug (auto-builds prompt from article)",
      prompt: "string — override prompt manually (optional)",
    },
    configured: isHiggsfieldConfigured(),
  });
}
