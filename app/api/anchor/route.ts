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
  startVideoGeneration,
  pollVideoGeneration,
  isVertexConfigured,
} from "@/lib/ai/vertex";
import { getLatestNews } from "@/content/news";
import { readCurrentAnchor, writeCurrentAnchor } from "@/lib/anchor/store";
import type { DailyAnchor } from "@/content/daily-anchor/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// Vertex Veo polling typically completes in 30-60s; allow up to 5 min for the
// full anchor pipeline (Claude script + ElevenLabs voice + Veo video poll).
export const maxDuration = 300;

/** Build the cinematic visual prompt that Veo 3 will render. */
function buildAnchorVideoPrompt(headline: string): string {
  return [
    `Cinematic aerial flyover of Dubai skyline at golden hour.`,
    `Burj Khalifa and Palm Jumeirah and Marina towers in frame.`,
    `Moody navy-and-gold color grade, 35mm anamorphic lens, slight film grain.`,
    `Subtle volumetric haze, light sun flares.`,
    `No people in frame, no text overlays, no logos.`,
    `Editorial documentary tone matching the headline mood: "${headline}".`,
  ].join(" ");
}

const SECRET = process.env.POST_PUBLISH_SECRET || "";

const SCRIPT_SYSTEM = `You are writing a 90-second daily-anchor script for Raj Tomar — a DLD-licensed Dubai real-estate broker who runs Beyond the Deal. He's reading this on camera, alone, to UHNW investors.

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

  // STAGE 3 — video via Vertex Veo 3 (billed against $100/mo Cloud credit).
  // Async — start operation, poll until done. Veo 3 typically completes a
  // 4-sec clip in 30-90 sec; we poll up to ~3 min before bailing.
  if ((mode === "video" || mode === "full") && isVertexConfigured()) {
    const videoPrompt = buildAnchorVideoPrompt(headline);
    const start = await startVideoGeneration({
      prompt: videoPrompt,
      aspectRatio: "16:9",
      durationSeconds: 4,
    });

    if (start.ok && start.operationName) {
      anchor.provider = "veo3";
      // Persist operation name immediately so the cron can resume polling if
      // we exceed the maxDuration ceiling
      (anchor as DailyAnchor & { operationId?: string }).operationId =
        start.operationName;
      await writeCurrentAnchor(anchor);

      // Poll inline — Veo 3 usually completes within Vercel's 5-min ceiling
      const maxPolls = 18; // 18 × 10s = 180s
      let completed = false;
      for (let i = 0; i < maxPolls; i++) {
        await new Promise((r) => setTimeout(r, 10_000));
        const poll = await pollVideoGeneration(start.operationName);
        if (!poll.ok) {
          break;
        }
        if (poll.done && poll.videoUri) {
          anchor.videoUrl = poll.videoUri;
          completed = true;
          break;
        }
      }
      if (!completed) {
        // Video still pending — anchor goes "ready" with audio only; cron can
        // resume polling later via mode="video-poll"
      }
    }
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
