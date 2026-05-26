// F13 — Daily cinematic intro endpoint (Gemini Omni / Veo 3).
// Called by the morning cron after publish. Generates a 4-second branded
// hero reel from the day's top story headline.
//
// Returns operation ID immediately (Veo generation is async). Cron polls
// the operation until videoUrl is set, then writes the URL to a small
// JSON file (content/daily-intro/current.json) that the homepage reads.

import { NextRequest, NextResponse } from "next/server";
import {
  generateVideo,
  getVideoOperation,
  buildDailyIntroPrompt,
  isGeminiConfigured,
} from "@/lib/ai/gemini";
import { promises as fs } from "node:fs";
import path from "node:path";
import { getLatestNews } from "@/content/news";

export const dynamic = "force-dynamic";

const SECRET = process.env.POST_PUBLISH_SECRET || "";

const STATE_PATH = path.join(process.cwd(), "pipeline-runs", "daily-intro.json");

async function writeState(state: Record<string, unknown>) {
  await fs.mkdir(path.dirname(STATE_PATH), { recursive: true });
  await fs.writeFile(STATE_PATH, JSON.stringify(state, null, 2), "utf-8");
}

async function readState(): Promise<Record<string, unknown> | null> {
  try {
    const raw = await fs.readFile(STATE_PATH, "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  if (!SECRET) return NextResponse.json({ error: "Secret not set" }, { status: 503 });
  if (request.nextUrl.searchParams.get("secret") !== SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isGeminiConfigured()) {
    return NextResponse.json(
      { ok: false, message: "Gemini Omni not configured — set GEMINI_API_KEY on Vercel." },
      { status: 503 }
    );
  }

  let body: { operationId?: unknown; headline?: unknown; scene?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    // empty OK
  }

  // Mode A — poll existing operation
  if (typeof body.operationId === "string") {
    const result = await getVideoOperation(body.operationId);
    if (result.ok && result.videoUrl) {
      await writeState({
        videoUrl: result.videoUrl,
        operationId: body.operationId,
        completedAt: new Date().toISOString(),
      });
    }
    return NextResponse.json(result);
  }

  // Mode B — kick off new generation
  const headlineFromBody = typeof body.headline === "string" ? body.headline : "";
  const sceneFromBody = typeof body.scene === "string" ? body.scene : undefined;
  const fallbackHeadline =
    getLatestNews(1)[0]?.title ||
    "Dubai real-estate desk — daily UAE intelligence";
  const headline = headlineFromBody || fallbackHeadline;

  const prompt = buildDailyIntroPrompt({ headline, scene: sceneFromBody });
  const start = await generateVideo({
    prompt,
    aspectRatio: "16:9",
    durationSeconds: 4,
  });

  if (start.ok && start.operationId) {
    await writeState({
      operationId: start.operationId,
      prompt,
      headline,
      startedAt: new Date().toISOString(),
    });
  }

  return NextResponse.json({ ...start, prompt, headline });
}

export async function GET() {
  const state = await readState();
  return NextResponse.json({
    name: "Daily intro (Gemini Omni / Veo 3)",
    method: "POST",
    auth: "?secret=<POST_PUBLISH_SECRET>",
    body: {
      operationId: "string (optional) — poll this existing operation",
      headline: "string (optional) — override headline",
      scene: "string (optional) — additional scene cue",
    },
    configured: isGeminiConfigured(),
    currentState: state,
  });
}
