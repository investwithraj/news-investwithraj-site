// Stock-image providers — Unsplash + Pexels + Wikimedia + Pixabay + Imagen 3.
// All five have free tiers commercial-use-OK. Wikimedia is keyless.
//
// Fallback chain (tried in order):
//   1. Unsplash         (best curation, requires key; 50/hr free demo)
//   2. Pexels           (good quality, requires key; 200/hr free)
//   3. Wikimedia        (keyless, vast catalog, varying quality)
//   4. Pixabay          (requires key; 5000/month free)
//   5. Imagen 3 via Gemini (Gemini Ultra subscription includes credit; fills
//                           gaps for niche queries Wikimedia doesn't cover)
//
// Env vars (all optional — silent skip when missing):
//   UNSPLASH_ACCESS_KEY
//   PEXELS_API_KEY
//   PIXABAY_API_KEY
//   GEMINI_API_KEY        (also powers the Daily Anchor pipeline)
//   IMAGEN_MODEL          (optional override, default imagen-3.0-fast-generate-001)

import type { StockImage, StockSearchOptions } from "./types";

const UNSPLASH_KEY = process.env.UNSPLASH_ACCESS_KEY || "";
const PEXELS_KEY = process.env.PEXELS_API_KEY || "";
const PIXABAY_KEY = process.env.PIXABAY_API_KEY || "";
const GEMINI_KEY = process.env.GEMINI_API_KEY || "";
// Imagen 4 family (May 2026):
//   imagen-4.0-fast-generate-001   — cheapest, fastest, default
//   imagen-4.0-generate-001        — standard quality
//   imagen-4.0-ultra-generate-001  — highest quality (most expensive)
// NB: All Imagen models require GCP billing enabled. Gemini Ultra
// consumer subscription does NOT include API image generation credit.
const IMAGEN_MODEL =
  process.env.IMAGEN_MODEL || "imagen-4.0-fast-generate-001";

/* ─── Unsplash ───────────────────────────────────────────────────────── */

export async function searchUnsplash(
  opts: StockSearchOptions
): Promise<StockImage[]> {
  if (!UNSPLASH_KEY) return [];
  try {
    const params = new URLSearchParams({
      query: opts.query,
      per_page: String(opts.perPage || 5),
      orientation: opts.orientation || "landscape",
    });
    const res = await fetch(
      `https://api.unsplash.com/search/photos?${params.toString()}`,
      {
        headers: { Authorization: `Client-ID ${UNSPLASH_KEY}` },
        next: { revalidate: 3600 },
      }
    );
    if (!res.ok) return [];
    const data = (await res.json()) as {
      results?: Array<{
        urls: { full: string; regular: string; small: string };
        links: { html: string };
        user: { name: string; links: { html: string } };
        width: number;
        height: number;
        alt_description?: string;
      }>;
    };
    return (data.results || [])
      .filter((r) => !opts.minWidth || r.width >= opts.minWidth)
      .map((r) => ({
        url: r.urls.regular,
        thumbnailUrl: r.urls.small,
        attributionUrl: r.links.html,
        credit: r.user.name,
        license: "Unsplash License (commercial-OK)",
        width: r.width,
        height: r.height,
        source: "unsplash" as const,
        alt: r.alt_description || opts.query,
      }));
  } catch {
    return [];
  }
}

/* ─── Pexels ─────────────────────────────────────────────────────────── */

export async function searchPexels(
  opts: StockSearchOptions
): Promise<StockImage[]> {
  if (!PEXELS_KEY) return [];
  try {
    const params = new URLSearchParams({
      query: opts.query,
      per_page: String(opts.perPage || 5),
      orientation: opts.orientation || "landscape",
    });
    const res = await fetch(
      `https://api.pexels.com/v1/search?${params.toString()}`,
      {
        headers: { Authorization: PEXELS_KEY },
        next: { revalidate: 3600 },
      }
    );
    if (!res.ok) return [];
    const data = (await res.json()) as {
      photos?: Array<{
        src: { large2x: string; large: string; medium: string };
        url: string;
        photographer: string;
        photographer_url: string;
        width: number;
        height: number;
        alt: string;
      }>;
    };
    return (data.photos || [])
      .filter((p) => !opts.minWidth || p.width >= opts.minWidth)
      .map((p) => ({
        url: p.src.large2x || p.src.large,
        thumbnailUrl: p.src.medium,
        attributionUrl: p.url,
        credit: p.photographer,
        license: "Pexels License (commercial-OK, no attribution required)",
        width: p.width,
        height: p.height,
        source: "pexels" as const,
        alt: p.alt || opts.query,
      }));
  } catch {
    return [];
  }
}

/* ─── Wikimedia Commons (keyless) ────────────────────────────────────── */

export async function searchWikimedia(
  opts: StockSearchOptions
): Promise<StockImage[]> {
  try {
    // First: text-search for files matching query
    const params = new URLSearchParams({
      action: "query",
      list: "search",
      srsearch: `${opts.query} filetype:bitmap|drawing`,
      srlimit: String(opts.perPage || 8),
      srnamespace: "6", // File: namespace
      format: "json",
      origin: "*",
    });
    const searchRes = await fetch(
      `https://commons.wikimedia.org/w/api.php?${params.toString()}`,
      { next: { revalidate: 3600 } }
    );
    if (!searchRes.ok) return [];
    const searchData = (await searchRes.json()) as {
      query?: { search?: Array<{ title: string }> };
    };
    const titles = (searchData.query?.search || []).map((r) => r.title);
    if (titles.length === 0) return [];

    // Then: get image info for each file
    const infoParams = new URLSearchParams({
      action: "query",
      titles: titles.join("|"),
      prop: "imageinfo",
      iiprop: "url|size|extmetadata",
      iiurlwidth: "1600",
      format: "json",
      origin: "*",
    });
    const infoRes = await fetch(
      `https://commons.wikimedia.org/w/api.php?${infoParams.toString()}`,
      { next: { revalidate: 3600 } }
    );
    if (!infoRes.ok) return [];
    const infoData = (await infoRes.json()) as {
      query?: {
        pages?: Record<
          string,
          {
            title: string;
            imageinfo?: Array<{
              thumburl?: string;
              url: string;
              width: number;
              height: number;
              extmetadata?: {
                Artist?: { value: string };
                LicenseShortName?: { value: string };
              };
            }>;
          }
        >;
      };
    };
    const pages = infoData.query?.pages || {};
    const out: StockImage[] = [];
    for (const page of Object.values(pages)) {
      const info = page.imageinfo?.[0];
      if (!info) continue;
      const license = info.extmetadata?.LicenseShortName?.value || "";
      // Filter to commercial-OK licenses (CC0, CC BY, CC BY-SA, PD)
      if (
        !license ||
        !/CC0|CC BY|public domain|PD/i.test(license)
      ) {
        continue;
      }
      if (opts.minWidth && info.width < opts.minWidth) continue;
      const artist = info.extmetadata?.Artist?.value || "Wikimedia Commons";
      // Strip HTML from artist (Wikimedia sometimes wraps in <a>)
      const cleanCredit = artist.replace(/<[^>]+>/g, "").trim();
      out.push({
        url: info.thumburl || info.url,
        thumbnailUrl: info.thumburl || info.url,
        attributionUrl: `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title)}`,
        credit: cleanCredit,
        license,
        width: info.width,
        height: info.height,
        source: "wikimedia",
        alt: page.title.replace(/^File:/, "").replace(/\.[a-z]+$/i, ""),
      });
    }
    return out;
  } catch {
    return [];
  }
}

/* ─── Pixabay ────────────────────────────────────────────────────────── */

export async function searchPixabay(
  opts: StockSearchOptions
): Promise<StockImage[]> {
  if (!PIXABAY_KEY) return [];
  try {
    const params = new URLSearchParams({
      key: PIXABAY_KEY,
      q: opts.query,
      per_page: String(opts.perPage || 5),
      orientation: opts.orientation === "portrait" ? "vertical" : "horizontal",
      image_type: "photo",
      safesearch: "true",
    });
    const res = await fetch(
      `https://pixabay.com/api/?${params.toString()}`,
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) return [];
    const data = (await res.json()) as {
      hits?: Array<{
        largeImageURL: string;
        webformatURL: string;
        pageURL: string;
        user: string;
        imageWidth: number;
        imageHeight: number;
        tags: string;
      }>;
    };
    return (data.hits || [])
      .filter((h) => !opts.minWidth || h.imageWidth >= opts.minWidth)
      .map((h) => ({
        url: h.largeImageURL,
        thumbnailUrl: h.webformatURL,
        attributionUrl: h.pageURL,
        credit: h.user,
        license: "Pixabay License (commercial-OK, no attribution required)",
        width: h.imageWidth,
        height: h.imageHeight,
        source: "pixabay" as const,
        alt: h.tags || opts.query,
      }));
  } catch {
    return [];
  }
}

/* ─── Imagen 3 via Gemini API (generates a synthetic image as fallback) ── */

/**
 * Build a high-quality prompt for editorial UAE real-estate photography.
 * The query is the user-facing search string ("Hudayriyat Island aerial");
 * we wrap it in cinematic-photography modifiers so Imagen returns photoreal
 * results rather than stylized illustrations.
 */
function buildImagenPrompt(query: string): string {
  return [
    `${query}.`,
    "Cinematic editorial photography, shot on a Sony A1 with 24-70mm GM lens,",
    "golden-hour lighting, ultra-high resolution, sharp detail,",
    "moody navy-and-gold color palette, slight film grain,",
    "Knight Frank / Mansion Global magazine aesthetic,",
    "no people in frame, no text overlays, no logos.",
  ].join(" ");
}

export async function generateImagen(
  opts: StockSearchOptions
): Promise<StockImage[]> {
  if (!GEMINI_KEY) return [];
  try {
    const prompt = buildImagenPrompt(opts.query);
    const aspectRatio =
      opts.orientation === "portrait"
        ? "9:16"
        : opts.orientation === "square"
          ? "1:1"
          : "16:9";

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${IMAGEN_MODEL}:predict?key=${GEMINI_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instances: [{ prompt }],
          parameters: {
            sampleCount: 1,
            aspectRatio,
            // safetyFilterLevel: "block_only_high",
            // personGeneration: "dont_allow",
          },
        }),
        cache: "no-store",
      }
    );
    if (!res.ok) return [];
    const data = (await res.json()) as {
      predictions?: Array<{
        bytesBase64Encoded?: string;
        mimeType?: string;
      }>;
    };
    const pred = data.predictions?.[0];
    if (!pred?.bytesBase64Encoded) return [];
    const mime = pred.mimeType || "image/png";
    return [
      {
        url: `data:${mime};base64,${pred.bytesBase64Encoded}`,
        thumbnailUrl: `data:${mime};base64,${pred.bytesBase64Encoded}`,
        attributionUrl: "https://deepmind.google/models/imagen-3/",
        credit: "Generated by Google Imagen 3",
        license: "Generated content — internal use",
        width: aspectRatio === "16:9" ? 1408 : aspectRatio === "9:16" ? 768 : 1024,
        height: aspectRatio === "16:9" ? 768 : aspectRatio === "9:16" ? 1408 : 1024,
        source: "imagen" as const,
        alt: opts.query,
      },
    ];
  } catch {
    return [];
  }
}

/* ─── Aggregator — tries every source in order, returns best match ──── */

/** Generic Dubai / UAE fallback queries when a specific subject yields zero. */
function broaderQueries(originalQuery: string): string[] {
  const lower = originalQuery.toLowerCase();
  const out: string[] = [];

  // Emirate-level broadening
  if (lower.includes("abu dhabi")) {
    out.push("Abu Dhabi skyline aerial", "Abu Dhabi corniche", "Abu Dhabi luxury architecture");
  } else if (lower.includes("ras al khaimah") || lower.includes("marjan")) {
    out.push("Ras Al Khaimah coastline", "RAK Al Marjan island aerial", "Ras Al Khaimah beach resort");
  } else {
    out.push("Dubai skyline aerial", "Dubai Marina sunset", "Dubai luxury architecture");
  }

  // Asset-type broadening (look at keywords in original)
  if (lower.includes("villa") || lower.includes("mansion")) {
    out.push("Dubai luxury villa", "UAE luxury home architecture");
  }
  if (lower.includes("tower") || lower.includes("apartment")) {
    out.push("Dubai luxury tower", "UAE skyscraper architecture");
  }
  if (lower.includes("beach") || lower.includes("coastline") || lower.includes("waterfront")) {
    out.push("Dubai beach resort", "UAE coastline aerial");
  }

  // Final catch-all
  out.push("UAE luxury real estate aerial");
  return out;
}

export async function searchStock(
  opts: StockSearchOptions
): Promise<StockImage[]> {
  // 1. Try the specific query first across all real-photo providers in parallel
  async function tryProviders(query: string): Promise<StockImage[]> {
    const subOpts = { ...opts, query };
    const promises: Promise<StockImage[]>[] = [];
    if (UNSPLASH_KEY) promises.push(searchUnsplash(subOpts));
    if (PEXELS_KEY) promises.push(searchPexels(subOpts));
    promises.push(searchWikimedia(subOpts)); // keyless — always run
    if (PIXABAY_KEY) promises.push(searchPixabay(subOpts));
    return (await Promise.all(promises)).flat();
  }

  const firstTry = await tryProviders(opts.query);
  if (firstTry.length > 0) return firstTry;

  // 2. Specific query empty — try broader fallback queries in sequence
  for (const broader of broaderQueries(opts.query)) {
    const results = await tryProviders(broader);
    if (results.length > 0) {
      // Tag the broader query so callers can see this was a fallback
      return results.map((r) => ({
        ...r,
        alt: `${r.alt || broader} (fallback from "${opts.query}")`,
      }));
    }
  }

  // 3. Last resort — Imagen 3 generation (if Gemini key configured + GCP billing on)
  if (GEMINI_KEY) {
    return generateImagen(opts);
  }
  return [];
}

/** Convenience — return the single best match. */
export async function findBestStockImage(
  opts: StockSearchOptions
): Promise<StockImage | null> {
  const results = await searchStock(opts);
  return results[0] || null;
}

export function isAnyStockConfigured(): boolean {
  return Boolean(UNSPLASH_KEY || PEXELS_KEY || PIXABAY_KEY || GEMINI_KEY) || true;
  // Always true because Wikimedia is keyless
}
