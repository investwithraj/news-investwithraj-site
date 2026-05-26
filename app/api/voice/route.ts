// /api/voice — Raj voice TTS endpoint.
// Powers Voice Mode (Hey Raj) + Audio article mode + Daily Anchor VO track.
//
// POST /api/voice
// body: { text: string, format?: "mp3" | "pcm" }
//
// Returns audio bytes inline (Content-Type: audio/mpeg). Rate-limited
// 20/hour/IP to keep ElevenLabs credit burn predictable.

import { NextRequest, NextResponse } from "next/server";
import { synthesise, isElevenConfigured } from "@/lib/voice/elevenlabs";
import { checkRateLimit, getClientIp } from "@/lib/ai/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!isElevenConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Voice synthesis offline — set ELEVENLABS_API_KEY on Vercel to enable.",
      },
      { status: 503 }
    );
  }

  const ip = getClientIp(request.headers);
  const limit = checkRateLimit(ip, { max: 20, windowMs: 60 * 60 * 1000 });
  if (!limit.allowed) {
    return NextResponse.json(
      {
        ok: false,
        message: `Rate limit hit — try in ${Math.ceil((limit.resetAt - Date.now()) / 60000)} minutes.`,
      },
      { status: 429 }
    );
  }

  let body: { text?: unknown; format?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const text = typeof body.text === "string" ? body.text.trim() : "";
  const fmt = body.format === "pcm" ? "pcm_24000" : "mp3_44100_128";

  const result = await synthesise({ text, outputFormat: fmt });
  if (!result.ok || !result.audio) {
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: 502 }
    );
  }

  return new NextResponse(result.audio, {
    status: 200,
    headers: {
      "Content-Type": result.contentType || "audio/mpeg",
      "Cache-Control": "private, no-store",
      "X-RateLimit-Remaining": String(limit.remaining),
    },
  });
}

export function GET() {
  return NextResponse.json({
    name: "Raj voice TTS — ElevenLabs Reel-1 Emotional Mode",
    method: "POST",
    body: {
      text: "string (1-5000 chars)",
      format: "mp3 (default) or pcm",
    },
    voice: "Raj · 3PmZaGGPRbZDCjAl7KBE · multilingual_v2",
    settings: {
      stability: 0.4,
      similarity: 0.88,
      style: 0.2,
      speed: 1.0,
      speakerBoost: true,
    },
    rateLimit: "20 / hour / IP",
    configured: isElevenConfigured(),
  });
}
