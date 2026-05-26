// Distribution endpoint — schedule-skill calls this after committing
// articles to schedule social posts + fire Telegram/Discord immediately.
//
// Usage:
//   POST /api/distribute?secret=<POST_PUBLISH_SECRET>
//   body: {
//     "slugs": ["2026-05-26-modon-phase-2", "2026-05-26-rera-q1-bulletin"],
//     "channels": ["linkedin-personal", "x", "telegram", "discord"]  (optional)
//   }
//
// Returns DistributionRun summary per article.

import { NextRequest, NextResponse } from "next/server";
import { distributeBatch, type Channel, DEFAULT_PHASE_1_CHANNELS, getActiveChannels } from "@/lib/distribute";
import { NEWS_ARTICLES } from "@/content/news";

export const dynamic = "force-dynamic";

const SECRET = process.env.POST_PUBLISH_SECRET || "";

export async function GET() {
  const { active, inactive } = getActiveChannels();
  return NextResponse.json({
    name: "news.investwithraj.com distribution endpoint",
    method: "POST",
    auth: "?secret=<POST_PUBLISH_SECRET>",
    body: {
      slugs: "string[] — article slugs (from content/news/*.ts) to distribute",
      channels: `string[] (optional) — defaults to ${DEFAULT_PHASE_1_CHANNELS.join(", ")}`,
    },
    channelStatus: {
      active,
      inactive,
      activeCount: active.length,
      inactiveCount: inactive.length,
    },
  });
}

export async function POST(request: NextRequest) {
  if (!SECRET) {
    return NextResponse.json(
      { error: "POST_PUBLISH_SECRET env var not set — endpoint disabled" },
      { status: 503 }
    );
  }
  const provided = request.nextUrl.searchParams.get("secret");
  if (provided !== SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { slugs?: unknown; channels?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!Array.isArray(body.slugs)) {
    return NextResponse.json(
      { error: "Body must be { slugs: string[] }" },
      { status: 400 }
    );
  }

  const slugs = (body.slugs as unknown[]).filter(
    (s): s is string => typeof s === "string"
  );

  const channels: Channel[] =
    Array.isArray(body.channels) && body.channels.length > 0
      ? (body.channels.filter((c): c is Channel => typeof c === "string") as Channel[])
      : DEFAULT_PHASE_1_CHANNELS;

  // Resolve slugs to articles
  const articles = slugs
    .map((slug) => NEWS_ARTICLES.find((a) => a.slug === slug))
    .filter((a): a is (typeof NEWS_ARTICLES)[number] => a !== undefined);

  const missing = slugs.filter((s) => !articles.find((a) => a.slug === s));

  const runs = await distributeBatch(articles, channels);

  const totalScheduled = runs.reduce((sum, r) => sum + r.successCount, 0);
  const totalFailed = runs.reduce((sum, r) => sum + r.failureCount, 0);
  const totalSkipped = runs.reduce((sum, r) => sum + r.skippedCount, 0);

  return NextResponse.json(
    {
      ok: totalFailed === 0,
      processedArticles: articles.length,
      missingSlugs: missing,
      channelsRequested: channels,
      totals: {
        scheduled: totalScheduled,
        failed: totalFailed,
        skipped: totalSkipped,
      },
      runs,
      timestamp: new Date().toISOString(),
    },
    { status: totalFailed > 0 ? 207 : 200 }
  );
}
