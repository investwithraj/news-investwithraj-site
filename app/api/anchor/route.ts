// /api/anchor — Daily Anchor pipeline + status.
//
// GET  /api/anchor                       → current anchor state JSON
// POST /api/anchor?secret=…              → run/refresh pipeline (cron-fired)
//   body: { headline?, sourceSlug?, mode?: "script" | "voice" | "video" | "full" }
//
// State machine (mode = "full"):
//   1. Pick headline (override or latest news)
//   2. Generate 90-second VO script via Claude (Voice Profile enforced)
//   3. Synthesise audio via ElevenLabs Raj voice
//   4. (Optional) Generate lip-synced video via Higgsfield Soul / Gemini Veo
//   5. Persist to pipeline-runs/daily-anchor.json
//
// Graceful degradation: if no API keys, returns the most recent ready anchor
// untouched (or 503 if nothing has ever run).

import { NextRequest, NextResponse } from "next/server";
import { callClaude, isClaudeConfigured } from "@/lib/ai/claude";
import { synthesise, isElevenConfigured } from "@/lib/voice/elevenlabs";
import {
  searchStockVideo,
  pickByDateSeed,
} from "@/lib/stock/video-providers";
import { getLatestNews } from "@/content/news";
import { readCurrentAnchor, writeCurrentAnchor } from "@/lib/anchor/store";
import type { DailyAnchor } from "@/content/daily-anchor/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// Allow up to 5 min for the full anchor pipeline (Claude script + ElevenLabs
// voice + stock video search/fetch). Stock video typically resolves in <2s.
export const maxDuration = 300;

/** Build the search query for stock B-roll. Varies by headline mood. */
function buildAnchorVideoQuery(headline: string): string {
  const lower = headline.toLowerCase();

  // Try to match the dominant subject in the headline so the B-roll feels
  // tonally appropriate to the day's lead story.
  if (lower.includes("hudayriyat") || lower.includes("abu dhabi") || lower.includes("saadiyat") || lower.includes("yas")) {
    return "Abu Dhabi skyline aerial corniche golden hour";
  }
  if (lower.includes("ras al khaimah") || lower.includes("marjan") || lower.includes("wynn")) {
    return "Ras Al Khaimah coastline aerial sunset resort";
  }
  if (lower.includes("palm") || lower.includes("nakheel")) {
    return "Palm Jumeirah Dubai aerial sunset";
  }
  if (lower.includes("marina") || lower.includes("downtown") || lower.includes("burj")) {
    return "Dubai Marina Downtown aerial golden hour sunset";
  }
  // Fallback — generic Dubai cinematic
  return "Dubai skyline aerial golden hour cinematic drone";
}

const SECRET = process.env.POST_PUBLISH_SECRET || "";

const SCRIPT_SYSTEM = `You are writing a 90-second daily-anchor script for Raj Tomar — a Dubai real-estate consultant who runs Beyond the Deal. He's reading this on camera, alone, to UHNW investors.

Hard rules:
- 130-180 words. ONE TAKE — no scene cuts in the script.
- Open with a counter-intuitive lead about the day's headline.
- Land one concrete number with context.
- Use UK English, em-dashes — like this — are signature.
- Never: synergy, unlock value, 10x, passive income, amazing, guaranteed.
- Always: thesis, structural, absorption, catalyst, compression, escrow, DLD.
- Close with "Here's what I'd do" — one explicit action.
- Sign-off: "I'm Raj — back tomorrow."

Output ONLY the script. No stage directions, no "Hi everyone" — just start.`;

async function generateScript(headline: string): Promise<{
  ok: boolean;
  script?: string;
  error?: string;
}> {
  const res = await callClaude({
    system: SCRIPT_SYSTEM,
    messages: [
      {
        role: "user",
        content: `Today's headline: ${headline}\n\nWrite the script now.`,
      },
    ],
    maxTokens: 600,
    temperature: 0.5,
  });
  if (!res.ok || !res.text) return { ok: false, error: res.error };
  return { ok: true, script: res.text };
}

export async function POST(request: NextRequest) {
  if (!SECRET) {
    return NextResponse.json({ error: "Secret not set" }, { status: 503 });
  }
  if (request.nextUrl.searchParams.get("secret") !== SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    headline?: unknown;
    sourceSlug?: unknown;
    mode?: unknown;
  } = {};
  try {
    body = await request.json();
  } catch {
    // empty ok
  }

  const today = new Date().toISOString().slice(0, 10);
  const mode = (body.mode as string) || "full";

  // Pick headline
  const latest = getLatestNews(1)[0];
  const headline =
    (typeof body.headline === "string" && body.headline.trim()) ||
    (latest && latest.title) ||
    "Dubai real estate · daily desk update";
  const sourceSlug =
    (typeof body.sourceSlug === "string" && body.sourceSlug) ||
    latest?.slug ||
    undefined;

  const anchor: DailyAnchor = {
    date: today,
    headline,
    sourceSlug,
    script: "",
    state: "pending-script",
    updatedAt: new Date().toISOString(),
  };

  // STAGE 1 — script
  if (mode === "script" || mode === "full") {
    if (!isClaudeConfigured()) {
      return NextResponse.json(
        { ok: false, message: "Claude not configured — set ANTHROPIC_API_KEY." },
        { status: 503 }
      );
    }
    const s = await generateScript(headline);
    if (!s.ok || !s.script) {
      return NextResponse.json({ ok: false, error: s.error }, { status: 502 });
    }
    anchor.script = s.script;
    anchor.scriptedAt = new Date().toISOString();
    anchor.state = "pending-voice";
    anchor.updatedAt = new Date().toISOString();
    await writeCurrentAnchor(anchor);
  }

  // STAGE 2 — voice
  if (mode === "voice" || mode === "full") {
    if (!isElevenConfigured()) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "ElevenLabs not configured — set ELEVENLABS_API_KEY. Script saved without audio.",
          anchor,
        },
        { status: 503 }
      );
    }
    const existing = await readCurrentAnchor();
    const scriptForVoice =
      anchor.script || existing?.script || "";
    if (!scriptForVoice) {
      return NextResponse.json(
        { ok: false, error: "No script available to synthesise" },
        { status: 400 }
      );
    }
    const v = await synthesise({ text: scriptForVoice, outputFormat: "mp3_44100_128" });
    if (!v.ok || !v.audio) {
      return NextResponse.json({ ok: false, error: v.error }, { status: 502 });
    }
    // For now: embed as base64 data URL so it persists in the JSON (small enough for ~90s mp3)
    const audioB64 = Buffer.from(v.audio).toString("base64");
    anchor.audioUrl = `data:audio/mpeg;base64,${audioB64}`;
    anchor.state = "pending-video";
    anchor.updatedAt = new Date().toISOString();
    await writeCurrentAnchor(anchor);
  }

  // STAGE 3 — video via REAL stock footage (Pexels Videos + Coverr).
  // User wants real Dubai/Abu Dhabi/RAK drone footage from real videographers,
  // not AI-generated content. Pexels API key was already provisioned in the
  // cover-image pivot.
  //
  // Strategy: search the appropriate emirate-tagged drone footage, deterministically
  // pick one clip per date so the B-roll varies day-to-day but the same date
  // always shows the same video (consistent across cold-starts + replays).
  if (mode === "video" || mode === "full") {
    const query = buildAnchorVideoQuery(headline);
    const videos = await searchStockVideo({
      query,
      orientation: "landscape",
      minWidth: 1280,
      minDurationSec: 4,
      maxDurationSec: 30,
      perPage: 12,
    });
    const picked = pickByDateSeed(videos, today);
    if (picked) {
      anchor.provider = "pexels-video";
      anchor.videoUrl = picked.url;
      // Stash photographer + license metadata via a side field so we can
      // render attribution under the anchor on the homepage later
      (anchor as DailyAnchor & {
        videoCredit?: string;
        videoSource?: string;
        videoLicense?: string;
      }).videoCredit = picked.credit;
      (anchor as DailyAnchor & {
        videoCredit?: string;
        videoSource?: string;
        videoLicense?: string;
      }).videoSource = picked.source;
      (anchor as DailyAnchor & {
        videoCredit?: string;
        videoSource?: string;
        videoLicense?: string;
      }).videoLicense = picked.license;
    }
    // No "pending" intermediate state — stock search is synchronous + fast
  }

  // Final state — ready if we have audio (video is a bonus when Vertex configured)
  anchor.state = anchor.audioUrl ? "ready" : "failed";
  anchor.updatedAt = new Date().toISOString();
  await writeCurrentAnchor(anchor);

  return NextResponse.json({ ok: true, anchor });
}

export async function GET() {
  const anchor = await readCurrentAnchor();
  if (!anchor) {
    return NextResponse.json(
      {
        ok: false,
        message: "No anchor generated yet — first run fires on the morning cron.",
      },
      { status: 404 }
    );
  }
  return NextResponse.json(
    { ok: true, anchor },
    { headers: { "Cache-Control": "s-maxage=300, stale-while-revalidate=900" } }
  );
}
