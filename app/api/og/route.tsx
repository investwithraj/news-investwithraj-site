// Dynamic OG/branded image generator.
// Wraps any background image with the news.investwithraj.com brand overlay:
//   - Navy gradient at bottom
//   - Article title in serif
//   - Gold accent bar
//   - "news.investwithraj.com" mark
//   - Photo credit (small, bottom-right)
//
// Used as:
//   • Article meta openGraph.images URL → social previews look custom
//   • Optionally as the visible <img> on news listing cards
//
// GET /api/og?slug=2026-05-26-dld-21b-week
// GET /api/og?title=Some+Headline&bg=https%3A%2F%2F…&credit=Photographer

import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { getNewsBySlug } from "@/content/news";
import { findBestStockImage } from "@/lib/stock/providers";
import { buildQueryForArticle } from "@/lib/stock/query-builder";

export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const slug = searchParams.get("slug") || "";
  let title = searchParams.get("title") || "";
  let bg = searchParams.get("bg") || "";
  let credit = searchParams.get("credit") || "";
  let category = "";

  if (slug && !title) {
    const article = getNewsBySlug(slug);
    if (article) {
      title = article.title;
      category = article.category;
      // If no bg passed, fetch one from stock
      if (!bg) {
        const stock = await findBestStockImage({
          query: buildQueryForArticle(article),
          orientation: "landscape",
          minWidth: 1600,
        });
        if (stock) {
          bg = stock.url;
          credit = stock.credit;
        }
      }
    }
  }

  if (!title) title = "news.investwithraj.com";

  // Brand colors
  const NAVY = "#0A1024";
  const GOLD = "#C9A961";
  const GOLD_BRIGHT = "#E0C076";
  const PAPER = "#F9F6F0";

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
        {/* Background image (if provided) */}
        {bg && (
          <img
            src={bg}
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
        )}

        {/* Dark gradient overlay for legibility */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(180deg, rgba(10,16,36,0.10) 0%, rgba(10,16,36,0.45) 55%, rgba(10,16,36,0.95) 100%)",
            display: "flex",
          }}
        />

        {/* Top brand mark */}
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
            fontFamily: "Inter",
            letterSpacing: "0.18em",
            textTransform: "uppercase",
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: 999,
              background: GOLD_BRIGHT,
              display: "block",
            }}
          />
          <span>news.investwithraj.com</span>
        </div>

        {/* Category eyebrow */}
        {category && (
          <div
            style={{
              position: "absolute",
              top: 36,
              right: 56,
              color: GOLD_BRIGHT,
              fontSize: 16,
              fontFamily: "Inter",
              letterSpacing: "0.22em",
              textTransform: "uppercase",
            }}
          >
            {category.replace(/-/g, " ")}
          </div>
        )}

        {/* Gold accent bar */}
        <div
          style={{
            position: "absolute",
            bottom: 220,
            left: 56,
            width: 60,
            height: 3,
            background: GOLD,
            display: "block",
          }}
        />

        {/* Title */}
        <div
          style={{
            position: "absolute",
            bottom: 92,
            left: 56,
            right: 56,
            color: PAPER,
            fontSize: title.length > 80 ? 48 : title.length > 50 ? 56 : 64,
            lineHeight: 1.05,
            fontFamily: "FrauncesSerif",
            fontWeight: 500,
            letterSpacing: "-0.02em",
            display: "flex",
          }}
        >
          {title}
        </div>

        {/* Author line */}
        <div
          style={{
            position: "absolute",
            bottom: 48,
            left: 56,
            color: GOLD_BRIGHT,
            fontSize: 18,
            fontFamily: "Inter",
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
            DLD-licensed broker
          </span>
        </div>

        {/* Photo credit (small, bottom-right) */}
        {credit && (
          <div
            style={{
              position: "absolute",
              bottom: 24,
              right: 56,
              color: PAPER,
              opacity: 0.45,
              fontSize: 12,
              fontFamily: "Inter",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              display: "flex",
            }}
          >
            Photo · {credit}
          </div>
        )}
      </div>
    ),
    {
      width: 1200,
      height: 630,
      // Note: in production we can fetch + embed Fraunces / Inter font bytes
      // for higher fidelity. Default system serif/sans-serif is acceptable Day-1.
    }
  );
}
