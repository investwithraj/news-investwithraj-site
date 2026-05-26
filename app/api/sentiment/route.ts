// /api/sentiment — UAE real-estate sentiment heatmap data.
// Mock until Reddit + X + Telegram scrapers and Claude classification are wired.

import { NextResponse } from "next/server";
import { getMockSentimentSnapshot } from "@/lib/sentiment/mock";

export const revalidate = 1800; // 30 min — same TTL as the future real scrapers

export function GET() {
  const snapshot = getMockSentimentSnapshot();
  return NextResponse.json(snapshot, {
    headers: {
      "Cache-Control": "s-maxage=1800, stale-while-revalidate=7200",
    },
  });
}
