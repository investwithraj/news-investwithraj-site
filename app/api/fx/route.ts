// FX rates endpoint — AED base + global UHNW target currencies.
// 1-hour edge cache. Falls back to snapshot rates if upstream fails.

import { NextResponse } from "next/server";
import { fetchFxRates } from "@/lib/fx/rates";

export const revalidate = 3600;

export async function GET() {
  const snapshot = await fetchFxRates();
  return NextResponse.json(snapshot, {
    headers: {
      "Cache-Control": "s-maxage=3600, stale-while-revalidate=21600",
    },
  });
}
