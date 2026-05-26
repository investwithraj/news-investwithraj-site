// Stock-image providers — Unsplash + Pexels + Wikimedia Commons + Pixabay.
// All four have free tiers commercial-use-OK. Wikimedia is keyless.
//
// Fallback chain (tried in order):
//   1. Unsplash         (best curation, requires key; 50/hr free demo)
//   2. Pexels           (good quality, requires key; 200/hr free)
//   3. Wikimedia        (keyless, vast catalog, varying quality)
//   4. Pixabay          (requires key; 5000/month free)
//
// Env vars (all optional — silent skip when missing):
//   UNSPLASH_ACCESS_KEY
//   PEXELS_API_KEY
//   PIXABAY_API_KEY

import type { StockImage, StockSearchOptions } from "./types";

const UNSPLASH_KEY = process.env.UNSPLASH_ACCESS_KEY || "";
const PEXELS_KEY = process.env.PEXELS_API_KEY || "";
const PIXABAY_KEY = process.env.PIXABAY_API_KEY || "";

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

/* ─── Aggregator — tries every source in order, returns best match ──── */

export async function searchStock(
  opts: StockSearchOptions
): Promise<StockImage[]> {
  // Run all configured providers in parallel for speed
  const promises: Promise<StockImage[]>[] = [];
  if (UNSPLASH_KEY) promises.push(searchUnsplash(opts));
  if (PEXELS_KEY) promises.push(searchPexels(opts));
  promises.push(searchWikimedia(opts)); // keyless — always run
  if (PIXABAY_KEY) promises.push(searchPixabay(opts));

  const results = await Promise.all(promises);
  // Flatten, preserving order: Unsplash → Pexels → Wikimedia → Pixabay
  return results.flat();
}

/** Convenience — return the single best match. */
export async function findBestStockImage(
  opts: StockSearchOptions
): Promise<StockImage | null> {
  const results = await searchStock(opts);
  return results[0] || null;
}

export function isAnyStockConfigured(): boolean {
  return Boolean(UNSPLASH_KEY || PEXELS_KEY || PIXABAY_KEY) || true;
  // Always true because Wikimedia is keyless
}
