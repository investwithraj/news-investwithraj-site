// Higgsfield Soul image-generation client.
// F14 — AI cover image per news article. Generates a contextual hero image
// matched to article's (developer + neighborhood + time of day).
//
// Cached to Vercel Blob on first generation. Graceful no-op without
// HIGGSFIELD_API_KEY — articles render their existing placeholder hero.

const HIGGSFIELD_API_KEY = process.env.HIGGSFIELD_API_KEY || "";
const HIGGSFIELD_BASE = process.env.HIGGSFIELD_BASE_URL || "https://api.higgsfield.ai";

export function isHiggsfieldConfigured(): boolean {
  return Boolean(HIGGSFIELD_API_KEY);
}

export interface HiggsfieldImageRequest {
  /** Composed prompt — should include the desired aesthetic, subject, mood */
  prompt: string;
  /** Aspect ratio — most article heroes are 16:9 */
  aspectRatio?: "16:9" | "1:1" | "9:16" | "4:3";
  /** Negative prompt */
  negativePrompt?: string;
  /** Seed for reproducibility */
  seed?: number;
}

export interface HiggsfieldImageResult {
  ok: boolean;
  /** Public URL of the generated image */
  url?: string;
  /** Generation cost in credits */
  credits?: number;
  error?: string;
}

/** Generate a single image. Returns a URL hosted on Higgsfield's CDN. */
export async function generateImage(
  req: HiggsfieldImageRequest
): Promise<HiggsfieldImageResult> {
  if (!isHiggsfieldConfigured()) {
    return { ok: false, error: "HIGGSFIELD_API_KEY not set" };
  }
  try {
    const res = await fetch(`${HIGGSFIELD_BASE}/v1/images/generate`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${HIGGSFIELD_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: req.prompt,
        negative_prompt: req.negativePrompt,
        aspect_ratio: req.aspectRatio || "16:9",
        seed: req.seed,
        model: "soul",
      }),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      return { ok: false, error: `Higgsfield ${res.status}: ${t.slice(0, 200)}` };
    }
    const data = (await res.json()) as {
      url?: string;
      image_url?: string;
      credits_used?: number;
    };
    const url = data.url || data.image_url;
    if (!url) return { ok: false, error: "No image URL in response" };
    return { ok: true, url, credits: data.credits_used };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}

/** Build a prompt from a NewsArticle-like input. */
export function buildArticleCoverPrompt(input: {
  category: string;
  market: string[];
  title: string;
}): string {
  const market = input.market.join(", ");
  return [
    "Cinematic editorial real-estate photography.",
    `Subject: ${input.title}`,
    `Setting: ${market} — golden hour, dramatic Dubai skyline, deep blue sky, warm gold reflections.`,
    "Style: Knight Frank / Mansion Global photography. Wide architectural composition.",
    "Texture: subtle film grain, navy + gold + cream palette, no people in frame.",
    "Negative: stock photo aesthetic, cluttered, neon, fluorescent, distorted geometry.",
  ].join(" ");
}
