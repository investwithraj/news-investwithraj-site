// Raj voice TTS endpoint.
//
// The public caller may submit only a short-lived, single-use grant created by
// /api/brief for its server-generated excerpt. Arbitrary caller-provided text,
// voice IDs, models, and output formats are never accepted.

import { NextRequest, NextResponse } from "next/server";
import { synthesise, isElevenConfigured } from "@/lib/voice/elevenlabs";
import {
  checkRateLimit,
  claimOnce,
  getClientIp,
  isFirstPartyMutation,
} from "@/lib/ai/rate-limit";
import {
  verifyVoiceGrant,
  voiceGrantsConfigured,
} from "@/lib/ai/voice-grant";
import { readJsonBody } from "@/lib/security/mutation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

function quotaUnavailable() {
  return NextResponse.json(
    { ok: false, message: "Voice is temporarily unavailable." },
    { status: 503, headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: NextRequest) {
  if (!isFirstPartyMutation(request)) {
    return NextResponse.json(
      { ok: false, message: "Forbidden" },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  }

  const clientIp = getClientIp(request.headers);
  const hourly = await checkRateLimit(clientIp, {
    namespace: "voice:hour",
    max: 5,
    windowMs: HOUR_MS,
  });
  if (hourly.reason === "unavailable") return quotaUnavailable();
  if (!hourly.allowed) {
    return NextResponse.json(
      { ok: false, message: "Voice limit reached. Try again later." },
      {
        status: 429,
        headers: {
          "Cache-Control": "no-store",
          "Retry-After": String(
            Math.max(1, Math.ceil((hourly.resetAt - Date.now()) / 1_000)),
          ),
        },
      },
    );
  }

  const daily = await checkRateLimit(clientIp, {
    namespace: "voice:day",
    max: 12,
    windowMs: DAY_MS,
  });
  if (daily.reason === "unavailable") return quotaUnavailable();
  if (!daily.allowed) {
    return NextResponse.json(
      { ok: false, message: "Daily voice limit reached." },
      {
        status: 429,
        headers: {
          "Cache-Control": "no-store",
          "Retry-After": String(
            Math.max(1, Math.ceil((daily.resetAt - Date.now()) / 1_000)),
          ),
        },
      },
    );
  }

  const parsed = await readJsonBody<{ grant?: unknown }>(request, {
    maxBytes: 16_384,
  });
  if (!parsed.ok) return parsed.response;
  const body = parsed.value;

  const grant = typeof body.grant === "string" ? body.grant : "";
  const verified = verifyVoiceGrant(grant, clientIp);
  if (!verified.ok) {
    const status = verified.reason === "unconfigured" ? 503 : 403;
    return NextResponse.json(
      {
        ok: false,
        message:
          status === 503
            ? "Voice is temporarily unavailable."
            : "Invalid or expired voice grant.",
      },
      { status, headers: { "Cache-Control": "no-store" } },
    );
  }

  if (!isElevenConfigured() || !voiceGrantsConfigured()) return quotaUnavailable();

  const claim = await claimOnce(
    "voice-grant",
    verified.jti,
    Math.max(1_000, verified.expiresAt - Date.now()),
  );
  if (claim.reason === "unavailable") return quotaUnavailable();
  if (!claim.claimed) {
    return NextResponse.json(
      { ok: false, message: "Voice grant already used." },
      { status: 409, headers: { "Cache-Control": "no-store" } },
    );
  }

  const result = await synthesise({
    text: verified.text,
    outputFormat: "mp3_44100_128",
  });
  if (!result.ok || !result.audio) {
    return NextResponse.json(
      { ok: false, message: "Voice synthesis failed." },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }

  return new NextResponse(result.audio, {
    status: 200,
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "X-RateLimit-Remaining": String(Math.min(hourly.remaining, daily.remaining)),
    },
  });
}

export function GET() {
  return NextResponse.json(
    {
      name: "Raj voice playback",
      method: "POST",
      body: { grant: "single-use grant returned by /api/brief" },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
