// Shared types for stock-image search across Unsplash / Pexels / Wikimedia.

export type StockSource =
  | "unsplash"
  | "pexels"
  | "wikimedia"
  | "pixabay";

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
}
