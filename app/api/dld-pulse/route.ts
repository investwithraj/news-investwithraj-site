// DLD daily pulse endpoint — feeds the homepage ticker + future graphs.
//
// GET /api/dld-pulse           → today's pulse
// GET /api/dld-pulse?date=YYYY-MM-DD → specific date's pulse
//
// Cached on Vercel for 6 hours (Bloomberg-style fresh-enough). Falls
// back to deterministic mock when DLD_API_KEY isn't configured.

import { NextRequest, NextResponse } from "next/server";
import { getDldPulse } from "@/lib/dld/pulse";

export const revalidate = 21600; // 6 hours

export async function GET(request: NextRequest) {
  const date = request.nextUrl.searchParams.get("date") || undefined;
  const pulse = await getDldPulse(date || undefined);
  return NextResponse.json(pulse, {
    headers: {
      "Cache-Control": "s-maxage=21600, stale-while-revalidate=86400",
    },
  });
}
