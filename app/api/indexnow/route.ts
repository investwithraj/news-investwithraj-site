// Manual IndexNow trigger — handy for testing + occasional one-off
// resubmissions outside the daily pipeline.
//
// Usage:
//   GET  /api/indexnow?url=https://news.investwithraj.com/news/example
//        → submits a single URL, returns JSON result
//   POST /api/indexnow
//        body: { "urls": ["https://news.investwithraj.com/news/a", ...] }
//        → batch submit up to 10,000 URLs
//
// Auth: POST requires ?secret=<POST_PUBLISH_SECRET> to prevent abuse.
// GET is open (read-only smoke-test) — IndexNow doesn't return URL lists.

import { NextRequest, NextResponse } from "next/server";
import { submitToIndexNow } from "@/lib/search/indexnow";

export const dynamic = "force-dynamic";

const SECRET = process.env.POST_PUBLISH_SECRET || "";

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");
  if (!url) {
    return NextResponse.json(
      { error: "Missing ?url parameter" },
      { status: 400 }
    );
  }
  const result = await submitToIndexNow([url]);
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}

export async function POST(request: NextRequest) {
  // Secret check — only configured callers can batch-submit
  if (SECRET) {
    const provided = request.nextUrl.searchParams.get("secret");
    if (provided !== SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (
    !body ||
    typeof body !== "object" ||
    !Array.isArray((body as { urls?: unknown }).urls)
  ) {
    return NextResponse.json(
      { error: "Body must be { urls: string[] }" },
      { status: 400 }
    );
  }

  const urls = (body as { urls: unknown[] }).urls.filter(
    (u): u is string => typeof u === "string"
  );

  const result = await submitToIndexNow(urls);
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
