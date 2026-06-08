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
// Imagen 4 generation now goes through lib/ai/vertex.ts via Vertex AI +
// Workload Identity Federation. Billed against $100/mo Cloud credit on the
// news-investwithraj project — see VERTEX_IMAGEN_MODEL env var to override
// the default (imagen-4.0-fast-generate-001) inside that module.

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
        id: string;
        urls: { full: string; regular: string; small: string };
        links: { html: string; download_location: string };
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
        photographerUrl: r.user.links.html,
        downloadTriggerUrl: r.links.download_location,
        sourceId: r.id,
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

/* ─── Openverse (keyless CC aggregator — 2nd keyless source w/ Wikimedia) ── */

export async function searchOpenverse(opts: StockSearchOptions): Promise<StockImage[]> {
  const minWidth = opts.minWidth ?? 1200;
  const aspect =
    opts.orientation === "portrait" ? "tall" : opts.orientation === "square" ? "square" : "wide";
  const params = new URLSearchParams({
    q: opts.query,
    license_type: "commercial",
    size: "large",
    aspect_ratio: aspect,
    mature: "false",
    page_size: String(Math.max(opts.perPage ?? 5, 5)),
  });
  try {
    const res = await fetch(`https://api.openverse.org/v1/images/?${params.toString()}`, {
      headers: {
        "User-Agent": "InvestWithRajNewsBot/1.0 (https://news.investwithraj.com)",
        Accept: "application/json",
      },
    });
    if (!res.ok) return [];
    const json = (await res.json()) as { results?: Array<Record<string, unknown>> };
    const results = json?.results ?? [];
    return results
      .filter((r) => typeof r.url === "string" && (!minWidth || ((r.width as number) ?? 0) >= minWidth))
      .map((r): StockImage => {
        const license = `${String(r.license ?? "").toUpperCase()}${r.license_version ? " " + r.license_version : ""}`.trim();
        return {
          url: r.url as string,
          thumbnailUrl: (r.thumbnail as string) || (r.url as string),
          attributionUrl: (r.foreign_landing_url as string) || (r.url as string),
          credit: String(r.attribution || `${r.creator || "Unknown"} — ${license} (via Openverse)`)
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 200),
          license: license || "CC (Openverse)",
          width: (r.width as number) ?? 0,
          height: (r.height as number) ?? 0,
          source: "openverse",
          alt: (r.title as string) || opts.query,
        };
      });
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

/**
 * Trigger an Unsplash download event. Required by the Unsplash API guidelines
 * whenever a photo is actually "used" (displayed to end users, rendered into
 * a final asset, etc.). Fire-and-forget — failure is non-blocking.
 *
 * Docs: https://unsplash.com/documentation#triggering-a-download
 */
export async function triggerUnsplashDownload(downloadUrl: string): Promise<void> {
  if (!UNSPLASH_KEY || !downloadUrl) return;
  try {
    await fetch(downloadUrl, {
      headers: { Authorization: `Client-ID ${UNSPLASH_KEY}` },
      cache: "no-store",
    });
  } catch {
    // Non-blocking — guideline compliance shouldn't break user requests
  }
}

/**
 * Build Unsplash attribution suffix that satisfies the license.
 *   Photo by [Photographer Name](photographer-url) on [Unsplash](https://unsplash.com/?utm_source=news-investwithraj&utm_medium=referral)
 * Caller renders this as markdown or assembles their own JSX.
 */
export function unsplashAttribution(img: {
  credit: string;
  photographerUrl?: string;
}): string {
  const photographer = img.photographerUrl
    ? `[${img.credit}](${img.photographerUrl}?utm_source=news-investwithraj&utm_medium=referral)`
    : img.credit;
  return `Photo by ${photographer} on [Unsplash](https://unsplash.com/?utm_source=news-investwithraj&utm_medium=referral)`;
}

/* ─── Imagen 4 via Vertex AI (synthetic fallback, billed against $100 GCP credit) ── */

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

/**
 * Generate via Vertex AI Imagen 4 (covered by the $100/mo Google Cloud
 * credit on the news-investwithraj project). Uses Workload Identity
 * Federation — no static service-account key on the Vercel side.
 *
 * Replaces the old `imagen-3-via-Gemini-Developer-API` path which was
 * paywalled on the free tier.
 */
export async function generateImagen(
  opts: StockSearchOptions
): Promise<StockImage[]> {
  // Lazy import — Vertex client pulls in google-auth-library + @vercel/oidc
  // which we only want loaded when actually needed.
  let vertex: typeof import("@/lib/ai/vertex");
  try {
    vertex = await import("@/lib/ai/vertex");
  } catch {
    return [];
  }
  if (!vertex.isVertexConfigured()) return [];

  try {
    const prompt = buildImagenPrompt(opts.query);
    const aspectRatio =
      opts.orientation === "portrait"
        ? "9:16"
        : opts.orientation === "square"
          ? "1:1"
          : "16:9";

    const result = await vertex.generateImage({
      prompt,
      aspectRatio,
      sampleCount: 1,
    });

    if (!result.ok || !result.images || result.images.length === 0) {
      return [];
    }

    return result.images.map((img) => ({
      url: img.dataUrl,
      thumbnailUrl: img.dataUrl,
      attributionUrl: "https://deepmind.google/models/imagen-4/",
      credit: "Generated by Google Imagen 4 (Vertex AI)",
      license: "Generated content — internal use only, not redistributable",
      width: img.width,
      height: img.height,
      source: "imagen" as const,
      alt: opts.query,
    }));
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
    promises.push(searchOpenverse(subOpts)); // keyless — always run
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

  // 3. Last resort — Imagen 4 via Vertex AI (covered by $100 GCP credit).
  // Skipped when allowSynthetic === false — news heroes must be real photos,
  // never AI-generated imagery presented as reporting.
  if (opts.allowSynthetic === false) return [];
  return generateImagen(opts);
}

// Titles/credits that signal the wrong subject (automated relevance can't see
// pixels, so we read the text for obvious non-place shots).
const JUNK_TITLE =
  /(navy|nimitz|warship|\bship\b|aircraft|soldier|portrait|wedding|\blogo\b|\bflag\b|\bmap\b|diagram|chart|\bcoin\b|stamp|banknote|interior|bedroom|protest)/i;

// Wrong-country tells in a file title. The photographer credit often says
// "Dubai" even when the photo is elsewhere, so geo-gate on the TITLE only.
const NON_UAE =
  /(niagara|canada|\bunited states\b|\busa\b|\blondon\b|\bparis\b|new york|singapore|mumbai|\bindia\b|\beurope\b|\bspain\b|\bitaly\b|toronto|sydney|\bchina\b|\bjapan\b)/i;

/** Relevance to the query + provider trust + hero-friendly aspect − wrong-subject/geo penalty. */
function rankStock(img: StockImage, tokens: string[]): number {
  const providerBonus =
    img.source === "wikimedia" ? 300
    : img.source === "openverse" ? 250
    : img.source === "imagen" ? -1000 // synthetic never wins over a real photo
    : 400; // unsplash / pexels / pixabay
  const aspect = img.width / Math.max(img.height, 1);
  const aspectBonus = aspect >= 1.4 && aspect <= 2.1 ? 200 : 0;
  const resBonus = Math.min(img.width, 4000) / 25;
  // Score relevance on the file TITLE (what's actually IN the image), never the
  // credit (photographer + home city — which is what put a Niagara photo top).
  const title = (img.alt ?? "").toLowerCase();
  const relevance = tokens.filter((t) => t.length > 2 && title.includes(t)).length * 180;
  const junk = JUNK_TITLE.test(title) ? 800 : 0;
  const offGeo = NON_UAE.test(title) ? 1200 : 0;
  return providerBonus + aspectBonus + resBonus + relevance - junk - offGeo;
}

/** Convenience — return the single best match (relevance-ranked, dedup-aware). */
export async function findBestStockImage(
  opts: StockSearchOptions
): Promise<StockImage | null> {
  let results = await searchStock(opts);
  const exclude = new Set(opts.excludeUrls ?? []);
  if (exclude.size) {
    results = results.filter((r) => !exclude.has(r.attributionUrl) && !exclude.has(r.url));
  }
  if (results.length === 0) return null;
  const tokens = opts.query.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  return [...results].sort((a, b) => rankStock(b, tokens) - rankStock(a, tokens))[0];
}

export function isAnyStockConfigured(): boolean {
  // Always true because Wikimedia is keyless — additional keys (Unsplash,
  // Pexels, Pixabay) and Vertex AI Imagen 4 progressively enhance results
  // but the baseline is never empty.
  return true;
}
