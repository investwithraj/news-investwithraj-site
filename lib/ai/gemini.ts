// Gemini Omni client.
// F13 — Daily cinematic intro generator. Google's multimodal video model
// (Gemini 2.5 + Veo 3 via Gemini Omni endpoint).
//
// Graceful no-op without GEMINI_API_KEY — the homepage simply skips the
// daily intro overlay.

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_BASE = process.env.GEMINI_BASE_URL || "https://generativelanguage.googleapis.com/v1beta";
const GEMINI_VIDEO_MODEL = process.env.GEMINI_VIDEO_MODEL || "veo-3.0-generate-preview";

export function isGeminiConfigured(): boolean {
  return Boolean(GEMINI_API_KEY);
}

export interface GeminiVideoRequest {
  /** Composed prompt describing the 4-second clip */
  prompt: string;
  /** Aspect ratio */
  aspectRatio?: "16:9" | "9:16" | "1:1";
  /** Duration seconds (typical: 4) */
  durationSeconds?: number;
}

export interface GeminiVideoResult {
  ok: boolean;
  /** Operation ID — needed for status polling */
  operationId?: string;
  /** Public URL once the operation completes (poll separately) */
  videoUrl?: string;
  error?: string;
}

/** Kick off a video generation job. Returns operationId — poll for completion. */
export async function generateVideo(req: GeminiVideoRequest): Promise<GeminiVideoResult> {
  if (!isGeminiConfigured()) {
    return { ok: false, error: "GEMINI_API_KEY not set" };
  }
  try {
    const res = await fetch(
      `${GEMINI_BASE}/models/${GEMINI_VIDEO_MODEL}:predictLongRunning?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instances: [
            {
              prompt: req.prompt,
              aspectRatio: req.aspectRatio || "16:9",
              durationSeconds: req.durationSeconds || 4,
            },
          ],
        }),
      }
    );
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      return { ok: false, error: `Gemini ${res.status}: ${t.slice(0, 200)}` };
    }
    const data = (await res.json()) as { name?: string };
    if (!data.name) return { ok: false, error: "No operation name in response" };
    return { ok: true, operationId: data.name };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}

/** Poll an operation. Returns the videoUrl when ready. */
export async function getVideoOperation(
  operationId: string
): Promise<GeminiVideoResult> {
  if (!isGeminiConfigured()) {
    return { ok: false, error: "GEMINI_API_KEY not set" };
  }
  try {
    const res = await fetch(
      `${GEMINI_BASE}/${operationId}?key=${GEMINI_API_KEY}`,
      { headers: { "Content-Type": "application/json" } }
    );
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      return { ok: false, error: `Gemini poll ${res.status}: ${t.slice(0, 200)}` };
    }
    const data = (await res.json()) as {
      done?: boolean;
      response?: { predictions?: Array<{ video?: { uri?: string } }> };
    };
    if (!data.done) {
      return { ok: true, operationId };
    }
    const uri = data.response?.predictions?.[0]?.video?.uri;
    if (!uri) return { ok: false, error: "Operation complete but no video URI" };
    return { ok: true, operationId, videoUrl: uri };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}

/** Build a prompt from the day's top news headline. */
export function buildDailyIntroPrompt(input: {
  headline: string;
  scene?: string;
}): string {
  const base = [
    "Cinematic 4-second editorial intro reel for a Dubai real-estate news brand.",
    "Aerial dolly through Dubai skyline at golden hour — Burj Khalifa, Palm Jumeirah, Marina towers gleaming.",
    "Subtle gold-light streaks, warm cream + navy + gold palette, no people in frame.",
    `Today's lead story: ${input.headline}`,
    input.scene ? `Specific scene cue: ${input.scene}` : "",
    "Style: Apple keynote intro × Bloomberg open. 35mm filmic grain.",
    "Negative: stock photo, animation, cartoonish, neon, sci-fi, flying objects.",
  ];
  return base.filter(Boolean).join(" ");
}
