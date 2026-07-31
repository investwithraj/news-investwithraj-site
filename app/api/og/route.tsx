// Pure, deterministic OG renderer. It accepts a canonical article slug only
// and may render only an already-approved, owned article-local image.

import { ImageResponse } from "next/og";
import { NextRequest, NextResponse } from "next/server";
import { getNewsBySlug } from "@/content/news";
import { SITE } from "@/lib/constants";
import { hasVerifiedEditorialImage } from "@/lib/news-editorial";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CACHE_CONTROL =
  "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  if ([...searchParams.keys()].some((key) => key !== "slug")) {
    return NextResponse.json(
      { error: "Only the canonical article slug is accepted." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const slug = searchParams.get("slug") ?? "";
  if (slug && !/^[a-z0-9-]{1,180}$/.test(slug)) {
    return NextResponse.json(
      { error: "Invalid article slug." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const article = slug ? getNewsBySlug(slug) : null;
  if (slug && !article) {
    return NextResponse.json(
      { error: "Article not found." },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }

  const title = article?.title ?? SITE.name;
  const category = article?.category ?? "";
  const hasImage = article ? hasVerifiedEditorialImage(article) : false;
  const background =
    article && hasImage
      ? new URL(article.heroImage.src, SITE.url).toString()
      : "";
  const credit = article && hasImage ? article.heroImage.credit : "";

  const NAVY = "#090B10";
  const COBALT = "#596BFF";
  const COBALT_LIGHT = "#B8C0FF";
  const PAPER = "#F2EEE7";

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          background: NAVY,
          position: "relative",
        }}
      >
        {background ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={background}
            width="1200"
            height="630"
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: "center",
            }}
            alt=""
          />
        ) : null}

        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(180deg,rgba(9,11,16,.18) 0%,rgba(9,11,16,.55) 54%,rgba(9,11,16,.97) 100%)",
            display: "flex",
          }}
        />

        <div
          style={{
            position: "absolute",
            top: 36,
            left: 56,
            display: "flex",
            alignItems: "center",
            gap: 12,
            color: PAPER,
            fontSize: 18,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: 999,
              background: COBALT_LIGHT,
              display: "block",
            }}
          />
          <span>news.investwithraj.com</span>
        </div>

        {category ? (
          <div
            style={{
              position: "absolute",
              top: 36,
              right: 56,
              color: COBALT_LIGHT,
              fontSize: 16,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              display: "flex",
            }}
          >
            {category.replace(/-/g, " ")}
          </div>
        ) : null}

        <div
          style={{
            position: "absolute",
            bottom: 220,
            left: 56,
            width: 60,
            height: 3,
            background: COBALT,
            display: "block",
          }}
        />

        <div
          style={{
            position: "absolute",
            bottom: 92,
            left: 56,
            right: 56,
            color: PAPER,
            fontSize: title.length > 80 ? 48 : title.length > 50 ? 56 : 64,
            lineHeight: 1.05,
            fontWeight: 500,
            letterSpacing: "-0.02em",
            display: "flex",
          }}
        >
          {title}
        </div>

        <div
          style={{
            position: "absolute",
            bottom: 48,
            left: 56,
            color: COBALT_LIGHT,
            fontSize: 18,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            display: "flex",
            alignItems: "center",
            gap: 16,
          }}
        >
          <span>By Raj Tomar</span>
          <span style={{ opacity: 0.5 }}>·</span>
          <span style={{ color: PAPER, opacity: 0.7 }}>
            property advisor
          </span>
        </div>

        {credit ? (
          <div
            style={{
              position: "absolute",
              bottom: 24,
              right: 56,
              color: PAPER,
              opacity: 0.55,
              fontSize: 12,
              letterSpacing: "0.1em",
              display: "flex",
            }}
          >
            Photo · {credit}
          </div>
        ) : null}
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: {
        "Cache-Control": CACHE_CONTROL,
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}
