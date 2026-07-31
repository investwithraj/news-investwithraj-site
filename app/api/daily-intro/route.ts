// F13 — Daily cinematic intro endpoint (Gemini Omni / Veo 3).
// Called by the morning cron after publish. Generates a 4-second branded
// hero reel from the day's top story headline.
//
// Returns operation ID immediately (Veo generation is async). Cron polls
// the operation until videoUrl is set, then writes the URL to a small
// JSON file (content/daily-intro/current.json) that the homepage reads.

import { NextRequest } from "next/server";
import {
  generateVideo,
  getVideoOperation,
  buildDailyIntroPrompt,
  isGeminiConfigured,
} from "@/lib/ai/gemini";
import { promises as fs } from "node:fs";
import path from "node:path";
import { getLatestNews } from "@/content/news";
import { syntheticEditorialMediaAllowed } from "@/lib/operations/features";
import {
  authorizeServerMutation,
  privateJson,
  publicStatusJson,
  readJsonBody,
} from "@/lib/security/mutation";

export const dynamic = "force-dynamic";

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
  const auth = authorizeServerMutation(request);
  if (!auth.ok) return auth.response;
  if (!syntheticEditorialMediaAllowed()) {
    return privateJson(
      {
        error:
          "Synthetic daily-intro video is disabled. No AI background video is approved for public production.",
      },
      410,
    );
  }
  if (!isGeminiConfigured()) {
    return privateJson(
      { ok: false, message: "Gemini video generation is not configured." },
      503,
    );
  }

  const parsed = await readJsonBody<{
    operationId?: unknown;
    headline?: unknown;
    scene?: unknown;
  }>(request, { maxBytes: 16_384, allowEmpty: true });
  if (!parsed.ok) return parsed.response;
  const body = parsed.value;

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
    return privateJson(result, result.ok ? 200 : 502);
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

  return privateJson(
    {
      ...start,
      prompt,
      headline,
      approvedForPublicUse: false,
    },
    start.ok ? 200 : 502,
  );
}

export async function GET() {
  const state = await readState();
  return publicStatusJson({
    name: "Synthetic daily intro",
    mutationMethod: "POST",
    available: syntheticEditorialMediaAllowed() && isGeminiConfigured(),
    productionPolicy:
      "disabled; the public site waits for Raj's properly filmed video",
    currentState:
      process.env.NODE_ENV === "production" ? null : state,
  });
}
