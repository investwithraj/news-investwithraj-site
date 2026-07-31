import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * No public score is emitted until a reviewed, durable source pipeline exists.
 * The former mock snapshot looked live and is deliberately unavailable.
 */
export function GET() {
  return NextResponse.json(
    {
      available: false,
      status: "research",
      message:
        "No public UAE property sentiment score is currently published.",
      methodology: "https://news.investwithraj.com/pulse",
    },
    {
      status: 503,
      headers: {
        "Cache-Control": "no-store, max-age=0",
        "X-Robots-Tag": "noindex, nofollow, noarchive",
      },
    },
  );
}
