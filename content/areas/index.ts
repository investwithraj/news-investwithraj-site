// Central registry of all area pages. Day-1: seed with the three areas
// already covered by IWR Notes (Hudayriyat / Palm Jebel Ali / Wynn Al
// Marjan) so the WorldMap pins on news.investwithraj.com match reality
// + the cross-links to investwithraj.com root work immediately.
//
// Body for each is intentionally empty Day-1 — populated by the daily
// programmatic-area-page job in Block 2.3. Stub area cards still render
// on /areas list page with cross-link to the IWR Note + a "Coming soon"
// CTA on the area's detail page.

import type { AreaPage } from "./types";
import { ADDITIONAL_AREAS } from "./catalog";
export type { AreaPage, AreaKind, AreaStat } from "./types";
export { sortAreas, filterByEmirate } from "./types";

const PRIORITY_AREAS: AreaPage[] = [
  {
    slug: "hudayriyat-island",
    name: "Hudayriyat Island",
    emirate: "Abu Dhabi",
    kind: "island",
    oneLiner:
      "Abu Dhabi's #1 transacting island. Sovereign-developed (Modon). AED 11.97B Q1 2026 volume.",
    excerpt:
      "Hudayriyat is Abu Dhabi's #1 transacting island by Q1 2026 DLD volume (AED 11.97B). 51M sqm, 53.5km coastline, sovereign-developed by Modon (ADX-listed, 58.1% sovereign-owned). Home to Surf Abu Dhabi, the Olympic Velodrome, Circuit X, and the Golf Estates launch (Note 03).",
    coords: { lat: 24.4539, lng: 54.3473 },
    publishedAt: "2026-05-26T00:00:00Z",
    modifiedAt: "2026-05-26T00:00:00Z",
    body: "", // Day-1 stub — populated by programmatic-area job
    stats: [
      { value: "AED 11.97B", unit: "Q1 2026", label: "Transaction volume — #1 in Abu Dhabi" },
      { value: "51M", unit: "sqm", label: "Total island area" },
      { value: "474", unit: "units", label: "Golf Estates launch (Note 03)" },
    ],
    developers: ["Modon Properties"],
    faq: [],
    citations: [],
    heroImage: {
      src: "/areas/hudayriyat-placeholder.jpg",
      alt: "Hudayriyat Island, Abu Dhabi",
      credit: "Placeholder — to be replaced with sourced image",
    },
    iwrNoteSlug: "hudayriyat-golf-estates",
  },
  {
    slug: "palm-jebel-ali",
    name: "Palm Jebel Ali",
    emirate: "Dubai",
    kind: "island",
    oneLiner:
      "Nakheel's re-launched second Palm. 80-frond geometry, 110km coastline, 35,000 planned units.",
    excerpt:
      "Palm Jebel Ali was relaunched by Nakheel in 2023 under a revised masterplan — different developer cadence, different cycle position from the paused 2008 vintage. 80 fronds, 110km of coastline. Currently trading at 40%+ discount to Palm Jumeirah secondary (Note 02 thesis).",
    coords: { lat: 24.9926, lng: 54.9892 },
    publishedAt: "2026-05-26T00:00:00Z",
    modifiedAt: "2026-05-26T00:00:00Z",
    body: "",
    stats: [
      { value: "80", unit: "fronds", label: "Masterplan geometry" },
      { value: "110km", unit: "coastline", label: "Total shoreline" },
      { value: "35,000", unit: "units", label: "Planned inventory" },
    ],
    developers: ["Nakheel"],
    faq: [],
    citations: [],
    heroImage: {
      src: "/areas/palm-jebel-ali-placeholder.jpg",
      alt: "Palm Jebel Ali, Dubai",
      credit: "Placeholder — to be replaced with sourced image",
    },
    iwrNoteSlug: "palm-jebel-ali-rerating",
    iwrRootAreaSlug: "palm-jebel-ali",
  },
  {
    slug: "wynn-al-marjan",
    name: "Wynn Al Marjan Island",
    emirate: "Ras Al Khaimah",
    kind: "development",
    oneLiner:
      "UAE's first integrated-resort licence. $3.9B / 1,500 keys. 2027 opening. Yield catalyst.",
    excerpt:
      "Wynn Al Marjan is the UAE's first integrated-resort licence — Wynn Resorts' ~$3.9B / 1,500-key commitment opening 2027. Drives the structural yield re-rating of adjacent branded residences, holiday-let villas, and serviced apartments within a 20-minute radius (Note 01 thesis).",
    coords: { lat: 25.6889, lng: 55.7861 },
    publishedAt: "2026-05-26T00:00:00Z",
    modifiedAt: "2026-05-26T00:00:00Z",
    body: "",
    stats: [
      { value: "$3.9B", unit: "investment", label: "Wynn Resorts commitment" },
      { value: "1,500", unit: "keys", label: "Resort scale" },
      { value: "2027", unit: "opening", label: "Target year" },
    ],
    developers: ["Wynn Resorts", "Marjan"],
    faq: [],
    citations: [],
    heroImage: {
      src: "/areas/wynn-al-marjan-placeholder.jpg",
      alt: "Wynn Al Marjan Island, RAK",
      credit: "Placeholder — to be replaced with sourced image",
    },
    iwrNoteSlug: "wynn-al-marjan-yield",
  },
];

export const AREAS: AreaPage[] = [...PRIORITY_AREAS, ...ADDITIONAL_AREAS];

export function getAreaBySlug(slug: string): AreaPage | null {
  return AREAS.find((a) => a.slug === slug) ?? null;
}

export function getAllAreaSlugs(): string[] {
  return AREAS.map((a) => a.slug);
}
