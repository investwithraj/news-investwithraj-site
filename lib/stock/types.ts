// Shared types for stock-image search across Unsplash / Pexels / Wikimedia.

export type StockSource =
  | "unsplash"
  | "pexels"
  | "wikimedia"
  | "openverse"
  | "pixabay"
  | "imagen";

export interface StockImage {
  /** Direct URL to the image (large size, JPG/WEBP) */
  url: string;
  /** Thumbnail URL for previews */
  thumbnailUrl: string;
  /** Original page where the image lives */
  attributionUrl: string;
  /** Photographer / source attribution name */
  credit: string;
  /** License identifier (CC0 / Unsplash License / CC BY-SA / etc.) */
  license: string;
  /** Width × Height in pixels */
  width: number;
  height: number;
  /** Which API returned this image */
  source: StockSource;
  /** Optional human-supplied caption / alt text */
  alt?: string;
  /** Unsplash-only — photographer profile URL (used for "Photo by X on Unsplash" attribution) */
  photographerUrl?: string;
  /** Unsplash-only — the download trigger endpoint URL we MUST ping when the photo is used (Unsplash API ToS) */
  downloadTriggerUrl?: string;
  /** Unsplash photo ID (for explicit download triggers later) */
  sourceId?: string;
}

export interface StockSearchOptions {
  /** Search query (e.g. "Dubai Marina aerial golden hour") */
  query: string;
  /** Preferred orientation */
  orientation?: "landscape" | "portrait" | "square";
  /** Minimum resolution width */
  minWidth?: number;
  /** Number of results to return */
  perPage?: number;
  /** Allow the synthetic (Imagen / Vertex AI) last-resort fallback. Default
   *  true; news heroes pass false so an article never ships an AI-generated
   *  photo presented as real reporting. */
  allowSynthetic?: boolean;
  /** Source/attribution URLs to skip — dedupe against recently-used images. */
  excludeUrls?: string[];
  /** Target emirate ("Dubai" | "Abu Dhabi" | "Ras Al Khaimah" | "UAE" | "GCC").
   *  When set, an image whose title signals a DIFFERENT emirate is penalised —
   *  so an Abu Dhabi story never lands a Dubai skyline. */
  emirate?: string;
}
