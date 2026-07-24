// /api/front — the front-page feed for cross-property consumption.
//
// investwithraj.com's home renders a news-with-covers section from this
// JSON (the RSS feed is text-only). Top six LIVE articles, each with its
// jury-approved local cover. CORS is open read-only: the payload is the
// same public content the front page serves.
import { NextResponse } from "next/server";
import { NEWS_ARTICLES, sortNewsArticles } from "@/content/news";

export const revalidate = 1800;

const SITE = "https://news.investwithraj.com";

export async function GET() {
  const items = sortNewsArticles(NEWS_ARTICLES)
    .filter((a) => a.status !== "research")
    .slice(0, 6)
    .map((a) => ({
      slug: a.slug,
      title: a.title,
      category: a.category,
      displayDate: a.displayDate,
      cover: a.heroImage?.src?.startsWith("/") ? `${SITE}${a.heroImage.src}` : a.heroImage?.src ?? null,
      url: `${SITE}/news/${a.slug}`,
    }));

  return NextResponse.json(
    { items, generatedAt: new Date().toISOString() },
    {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "s-maxage=1800, stale-while-revalidate=3600",
      },
    },
  );
}
