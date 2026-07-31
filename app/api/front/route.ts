// /api/front — the front-page feed for cross-property consumption.
//
// investwithraj.com's home renders a news-with-covers section from this
// JSON (the RSS feed is text-only). Editorial recency controls selection;
// cover eligibility is evaluated per item. A current text story must never
// disappear because an older story happens to have approved media.
import { NextResponse } from "next/server";
import { NEWS_ARTICLES, sortNewsArticles } from "@/content/news";
import {
  displayMarkets,
  evidenceSummary,
  hasVerifiedEditorialImage,
  selectDistinctArticles,
} from "@/lib/news-editorial";

export const revalidate = 1800;

const SITE = "https://news.investwithraj.com";
const ADVISORY_ORIGIN = "https://investwithraj.com";
const FRESH_WINDOW_MS = 48 * 60 * 60 * 1_000;

function headers() {
  return {
    "Access-Control-Allow-Origin": ADVISORY_ORIGIN,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Accept, Content-Type",
    "Cache-Control": "s-maxage=1800, stale-while-revalidate=3600",
    Vary: "Origin",
    "X-Content-Type-Options": "nosniff",
  };
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: headers() });
}

export async function GET() {
  const live = sortNewsArticles(NEWS_ARTICLES).filter(
    (article) => article.status !== "research",
  );
  const items = selectDistinctArticles(live, 6).map((a) => {
    const evidence = evidenceSummary(a);
    const hasCover = hasVerifiedEditorialImage(a);
    return {
      slug: a.slug,
      title: a.title,
      subtitle: a.subtitle,
      publishedAt: a.publishedAt,
      category: a.category,
      market: displayMarkets(a),
      signal: a.tldr?.[0] ?? null,
      displayDate: a.displayDate,
      evidence: {
        sourceCount: evidence.sourceCount,
        label: evidence.label,
        limited: evidence.limited,
      },
      cover: hasCover
        ? a.heroImage.src.startsWith("/")
          ? `${SITE}${a.heroImage.src}`
          : a.heroImage.src
        : null,
      url: `${SITE}/news/${a.slug}`,
    };
  });

  const newestPublishedAt = items[0]?.publishedAt ?? null;
  const newestTime = newestPublishedAt
    ? new Date(newestPublishedAt).getTime()
    : Number.NaN;
  const ageMs = Number.isFinite(newestTime)
    ? Math.max(0, Date.now() - newestTime)
    : null;
  const state =
    ageMs === null ? "empty" : ageMs <= FRESH_WINDOW_MS ? "fresh" : "stale";
  const withheldCoverCount = items.filter((item) => item.cover === null).length;

  return NextResponse.json(
    {
      available: items.length > 0,
      state: items.length > 0 ? "available" : "withheld",
      reason:
        items.length > 0
          ? withheldCoverCount > 0
            ? `${withheldCoverCount} latest report${withheldCoverCount === 1 ? "" : "s"} rendered text-only because UHD media approval is pending.`
            : null
          : "No reviewed live article is currently available.",
      items,
      media: {
        withheldCoverCount,
        approvedCoverCount: items.length - withheldCoverCount,
        limited: withheldCoverCount > 0,
      },
      generatedAt: new Date().toISOString(),
      freshness: {
        state,
        newestPublishedAt,
        ageHours: ageMs === null ? null : Math.round(ageMs / 3_600_000),
        thresholdHours: 48,
      },
    },
    {
      headers: headers(),
    },
  );
}
