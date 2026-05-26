// Programmatic Area page schema — one /areas/[slug] page per priority
// Dubai / Abu Dhabi / RAK community or master-plan island.
//
// Built progressively: ship Hudayriyat + Palm Jebel Ali + Saadiyat first
// (the islands actually mentioned in IWR Notes), then scale to 30+
// priority areas by Month 2 per master plan.
//
// Each area page also cross-links to investwithraj.com root if IWR root
// has curated mandates on that area (PJA distress positions etc).

import type { Citation, HeroImage, FaqItem } from "@/content/news/types";

export type AreaKind =
  | "island"           // Palm Jebel Ali, Hudayriyat, Saadiyat, Yas, Al Marjan
  | "community"        // Downtown Dubai, Marina, Business Bay, Palm Jumeirah
  | "free-zone"        // DIFC, ADGM-residential
  | "master-plan"      // Dubai 2040 corridors, Modon islands collective
  | "development";     // Single mega-project like Wynn Al Marjan

export interface AreaStat {
  /** Numeric or string value to display */
  value: string;
  /** Small uppercase unit / label */
  unit: string;
  /** Longer descriptor */
  label: string;
  /** Optional source citation slug from this area's citations array */
  sourceIndex?: number;
}

export interface AreaPage {
  /** URL slug at /areas/{slug} — kebab-case */
  slug: string;
  /** Display name as title */
  name: string;
  /** Geographic anchor */
  emirate: "Dubai" | "Abu Dhabi" | "Ras Al Khaimah";
  /** Kind */
  kind: AreaKind;
  /** One-line elevator pitch (≤ 140 chars) */
  oneLiner: string;
  /** Standfirst paragraph for the area page */
  excerpt: string;
  /** Lat/lng for the WorldMap pin */
  coords: { lat: number; lng: number };
  /** ISO publish timestamp */
  publishedAt: string;
  /** ISO last modified — drives the "Updated X ago" timestamp on the page */
  modifiedAt: string;
  /** Long-form body — paragraphs separated by \n\n.
   *  Word count target 800-2500 (validator gate 7). */
  body: string;
  /** Pinned facts about the area (the "vital statistics") */
  stats: AreaStat[];
  /** Active developers operating in this area */
  developers: string[];
  /** Median launch price per square foot (AED), if known */
  medianAedPerSqft?: number;
  /** Net yield band, if known. e.g. { min: 5.5, max: 7.0 } */
  netYieldBand?: { min: number; max: number };
  /** 5-8 FAQ items — emitted as FAQPage JSON-LD */
  faq: FaqItem[];
  /** Citations — ≥1 from the lib/sources/registry whitelist */
  citations: Citation[];
  /** Hero image */
  heroImage: HeroImage;
  /** When IWR root has curated mandates for this area, cross-link */
  iwrRootAreaSlug?: string;
  /** When a published IWR Note covers this area, link to it */
  iwrNoteSlug?: string;
  /** News-article slugs (this subdomain) that mention this area */
  relatedNewsSlugs?: string[];
  /** Insight-article slugs that deep-dive this area */
  relatedInsightSlugs?: string[];
}

/** Sort priority areas first (those with IWR Notes or active mandates). */
export function sortAreas(areas: AreaPage[]): AreaPage[] {
  return [...areas].sort((a, b) => {
    // Areas with IWR Notes or root mandates rank first
    const aPriority = (a.iwrNoteSlug ? 2 : 0) + (a.iwrRootAreaSlug ? 1 : 0);
    const bPriority = (b.iwrNoteSlug ? 2 : 0) + (b.iwrRootAreaSlug ? 1 : 0);
    if (aPriority !== bPriority) return bPriority - aPriority;
    // Then by name alphabetical for stability
    return a.name.localeCompare(b.name);
  });
}

/** Filter areas by emirate for emirate-grouped listing pages */
export function filterByEmirate(
  areas: AreaPage[],
  emirate: AreaPage["emirate"]
): AreaPage[] {
  return areas.filter((a) => a.emirate === emirate);
}
