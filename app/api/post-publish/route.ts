// Post-publish webhook — fired after every successful deploy that
// includes new articles. Fans out search-engine pings in parallel:
//
//   1. IndexNow → Bing + Yandex + Yep + Seznam + Naver + IndexNow.org
//   2. Google sitemap ping → www.google.com/ping?sitemap=
//   3. Bing sitemap ping → bing.com/ping?sitemap=
//
// Called by:
//   - The daily schedule-skill Claude session AFTER commit + push completes
//   - Optionally: Vercel Deploy Hook (configurable via Vercel project Settings)
//
// Usage (after a commit that adds new articles):
//   POST /api/post-publish?secret=<POST_PUBLISH_SECRET>
//   body: {
//     "newUrls": ["https://news.investwithraj.com/news/2026-05-26-foo"],
//     "deploymentId": "dpl_xyz" (optional, for logging)
//   }
//
// Returns a structured report of every ping attempted + its outcome.

import { NextRequest, NextResponse } from "next/server";
import { submitToIndexNow } from "@/lib/search/indexnow";
import { pingAllSitemaps } from "@/lib/search/google-ping";

export const dynamic = "force-dynamic";

const SECRET = process.env.POST_PUBLISH_SECRET || "";

export async function POST(request: NextRequest) {
  // Auth — required to prevent random callers triggering arbitrary pings
  if (!SECRET) {
    return NextResponse.json(
      {
        error:
          "POST_PUBLISH_SECRET env var not set on the deployment — endpoint disabled",
      },
      { status: 503 }
    );
  }
  const provided = request.nextUrl.searchParams.get("secret");
  if (provided !== SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { newUrls?: unknown; deploymentId?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    // Empty body is allowed — sitemap pings will still fire
  }

  const newUrls = Array.isArray(body.newUrls)
    ? body.newUrls.filter((u): u is string => typeof u === "string")
    : [];

  const t0 = performance.now();

  // Fire all pings in parallel
  const [indexNowResult, sitemapResults] = await Promise.all([
    newUrls.length > 0
      ? submitToIndexNow(newUrls)
      : Promise.resolve({
          ok: true,
          statusCode: 200,
          message: "No new URLs to submit to IndexNow",
          submittedUrls: 0,
        }),
    pingAllSitemaps(),
  ]);

  const elapsedMs = Math.round(performance.now() - t0);

  const allOk =
    indexNowResult.ok && sitemapResults.every((r) => r.ok);

  return NextResponse.json(
    {
      ok: allOk,
      deploymentId: typeof body.deploymentId === "string" ? body.deploymentId : null,
      submittedUrlCount: newUrls.length,
      indexNow: indexNowResult,
      sitemapPings: sitemapResults,
      elapsedMs,
      timestamp: new Date().toISOString(),
    },
    { status: allOk ? 200 : 207 } // 207 Multi-Status when partial success
  );
}

/** GET — health check + endpoint documentation */
export async function GET() {
  return NextResponse.json({
    name: "news.investwithraj.com post-publish webhook",
    method: "POST",
    auth: "Required query param ?secret=<POST_PUBLISH_SECRET>",
    body: {
      newUrls: "string[] — absolute URLs of articles newly published in this deploy",
      deploymentId: "string (optional) — Vercel deployment ID for log correlation",
    },
    fansOutTo: {
      indexNow: "Bing · Yandex · Yep · Seznam · Naver · IndexNow.org",
      googleSitemap: "https://www.google.com/ping",
      bingSitemap: "https://www.bing.com/ping",
    },
    response: "Structured per-engine result, 200 if all OK, 207 if partial",
  });
}
