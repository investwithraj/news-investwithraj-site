// Stock VIDEO providers — Pexels Videos + Coverr.
//
// Used by Daily Anchor for the silent B-roll layer (real Dubai/Abu Dhabi
// drone footage looped under the ElevenLabs Raj voiceover). No AI-generated
// video — user explicitly wants real footage from real videographers.
//
// Providers:
//   1. Pexels Videos      (PEXELS_API_KEY — same key as the photo provider)
//   2. Coverr             (keyless, CC0-equivalent, smaller catalog)
//
// All are commercial-use-OK with proper attribution.

const PEXELS_KEY = process.env.PEXELS_API_KEY || "";

export type VideoStockSource = "pexels-video" | "coverr";

export interface StockVideo {
  /** Direct MP4 URL (largest available) */
  url: string;
  /** Lower-res preview URL */
  previewUrl: string;
  /** Thumbnail / poster image */
  posterUrl: string;
  /** Original page on the provider's site */
  attributionUrl: string;
  /** Videographer name */
  credit: string;
  /** License identifier */
  license: string;
  /** Width × Height */
  width: number;
  height: number;
  /** Duration in seconds */
  durationSec: number;
  /** Which provider returned this video */
  source: VideoStockSource;
  /** Optional caption / context */
  alt?: string;
}

export interface VideoSearchOptions {
  /** Search query */
  query: string;
  /** Preferred orientation */
  orientation?: "landscape" | "portrait" | "square";
  /** Minimum resolution width (typical 1280 for 720p, 1920 for 1080p) */
  minWidth?: number;
  /** Minimum duration in seconds (filter out very short clips) */
  minDurationSec?: number;
  /** Max duration in seconds (filter out very long clips that bloat KV) */
  maxDurationSec?: number;
  /** Number of results to return per provider */
  perPage?: number;
}

/* ─── Pexels Videos ──────────────────────────────────────────────────── */

export async function searchPexelsVideos(
  opts: VideoSearchOptions
): Promise<StockVideo[]> {
  if (!PEXELS_KEY) return [];
  try {
    const params = new URLSearchParams({
      query: opts.query,
      per_page: String(opts.perPage || 8),
      orientation: opts.orientation || "landscape",
      size: "medium", // medium = 1280×720+; large = 4K
    });
    const res = await fetch(
      `https://api.pexels.com/videos/search?${params.toString()}`,
      {
        headers: { Authorization: PEXELS_KEY },
        next: { revalidate: 3600 },
      }
    );
    if (!res.ok) return [];
    const data = (await res.json()) as {
      videos?: Array<{
        id: number;
        url: string;
        duration: number;
        image: string; // poster
        user: { name: string; url: string };
        width: number;
        height: number;
        video_files: Array<{
          link: string;
          quality: string; // "uhd" | "hd" | "sd"
          width: number;
          height: number;
          file_type: string;
        }>;
        video_pictures?: Array<{ picture: string }>;
      }>;
    };
    return (data.videos || [])
      .filter((v) => {
        if (opts.minWidth && v.width < opts.minWidth) return false;
        if (opts.minDurationSec && v.duration < opts.minDurationSec) return false;
        if (opts.maxDurationSec && v.duration > opts.maxDurationSec) return false;
        return true;
      })
      .map((v) => {
        // Prefer hd (1920×1080 or 1280×720) over uhd (4K — too heavy) and sd.
        // If hd not available, fall back to the largest available.
        const files = v.video_files.filter((f) => f.file_type === "video/mp4");
        const hd = files.find((f) => f.quality === "hd");
        const sd = files.find((f) => f.quality === "sd");
        const chosen = hd || sd || files[0];
        return {
          url: chosen?.link || "",
          previewUrl: sd?.link || chosen?.link || "",
          posterUrl: v.image,
          attributionUrl: v.url,
          credit: v.user.name,
          license: "Pexels License (commercial-OK, no attribution required)",
          width: chosen?.width || v.width,
          height: chosen?.height || v.height,
          durationSec: v.duration,
          source: "pexels-video" as const,
          alt: opts.query,
        };
      })
      .filter((v) => v.url); // drop any without a usable mp4
  } catch {
    return [];
  }
}

/* ─── Coverr (keyless — public catalog feeds) ────────────────────────── */

/**
 * Coverr has a JSON catalog at coverr.co/api but it's not officially documented
 * + has been intermittently rate-limited. For now we hit their search HTML
 * page and parse the data attributes. Simpler + more reliable than the API.
 *
 * Falls through gracefully when Coverr's site changes shape — Pexels Videos
 * is the primary source.
 */
export async function searchCoverr(
  opts: VideoSearchOptions
): Promise<StockVideo[]> {
  // Coverr's public search endpoint returns HTML, not JSON. Parsing it is
  // brittle. We skip this until they publish a proper API. Stub kept so the
  // chain shape is consistent.
  void opts;
  return [];
}

/* ─── Aggregator ─────────────────────────────────────────────────────── */

/** Returns all matching stock videos, in preference order. */
export async function searchStockVideo(
  opts: VideoSearchOptions
): Promise<StockVideo[]> {
  const promises: Promise<StockVideo[]>[] = [];
  if (PEXELS_KEY) promises.push(searchPexelsVideos(opts));
  promises.push(searchCoverr(opts));
  const all = (await Promise.all(promises)).flat();
  return all;
}

/** Pick a single stock video deterministically — same date → same video.
 *  Lets the Daily Anchor pick a varied clip each day from the result set. */
export function pickByDateSeed(
  videos: StockVideo[],
  dateStr: string
): StockVideo | null {
  if (videos.length === 0) return null;
  // Hash the date string into a stable index
  let h = 0;
  for (let i = 0; i < dateStr.length; i++) {
    h = (h << 5) - h + dateStr.charCodeAt(i);
    h |= 0;
  }
  const idx = Math.abs(h) % videos.length;
  return videos[idx];
}
