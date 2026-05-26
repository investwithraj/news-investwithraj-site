// Smoke-test endpoint for Vertex Veo 3 video generation via WIF.
// Veo is async — kicks off a long-running operation, returns operation name.
// Caller polls via ?op=<operationName> until done=true with videoUri.
//
// GET /api/veo-test?secret=<POST_PUBLISH_SECRET>  — start fresh generation
// GET /api/veo-test?secret=...&op=<operation>      — poll status

import { NextRequest, NextResponse } from "next/server";
import {
  isVertexConfigured,
  startVideoGeneration,
  pollVideoGeneration,
} from "@/lib/ai/vertex";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SECRET = process.env.POST_PUBLISH_SECRET || "";

export async function GET(request: NextRequest) {
  if (!SECRET) {
    return NextResponse.json({ error: "POST_PUBLISH_SECRET not set" }, { status: 503 });
  }
  if (request.nextUrl.searchParams.get("secret") !== SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isVertexConfigured()) {
    return NextResponse.json({
      ok: false,
      configured: false,
      message: "Vertex AI WIF env vars not set",
    });
  }

  const op = request.nextUrl.searchParams.get("op");

  // Poll existing operation
  if (op) {
    const t0 = performance.now();
    const result = await pollVideoGeneration(op);
    const elapsedMs = Math.round(performance.now() - t0);
    return NextResponse.json({
      mode: "poll",
      operation: op,
      result,
      elapsedMs,
    });
  }

  // Start fresh generation
  const t0 = performance.now();
  const result = await startVideoGeneration({
    prompt:
      "Cinematic aerial flyover of Dubai skyline at golden hour, Burj Khalifa and Palm Jumeirah in frame, moody navy and gold color grade, slight film grain, 35mm anamorphic lens look, ultra-high resolution",
    durationSeconds: 4,
    aspectRatio: "16:9",
  });
  const elapsedMs = Math.round(performance.now() - t0);

  return NextResponse.json({
    mode: "start",
    result,
    elapsedMs,
    pollInstructions: result.operationName
      ? `curl "https://news.investwithraj.com/api/veo-test?secret=$SECRET&op=${encodeURIComponent(result.operationName)}"`
      : null,
  });
}
