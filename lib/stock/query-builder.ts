// Build a stock-image search query from article metadata.
// Maps developer / area / asset-type / category into a punchy 3-5 word
// search string optimized for each provider.

import type { NewsArticle } from "@/content/news/types";

const DEVELOPER_QUERIES: Record<string, string> = {
  emaar: "Downtown Dubai Burj Khalifa skyline aerial",
  aldar: "Abu Dhabi Saadiyat Island beach aerial",
  nakheel: "Palm Jumeirah Dubai aerial sunset",
  modon: "Hudayriyat Island Abu Dhabi coastline aerial",
  damac: "Dubai luxury apartment tower architecture",
  sobha: "Dubai residential tower modern luxury",
  "dubai-holding": "Dubai cityscape skyline modern",
  "ifa-hotels": "Palm Jumeirah luxury hotel resort",
  marjan: "Ras Al Khaimah coastline luxury resort",
};

const AREA_QUERIES: Record<string, string> = {
  "downtown-dubai": "Downtown Dubai Burj Khalifa golden hour",
  "dubai-marina": "Dubai Marina yachts aerial sunset",
  "palm-jumeirah": "Palm Jumeirah aerial Dubai luxury",
  jbr: "JBR Jumeirah Beach Residence Dubai beachfront",
  "business-bay": "Business Bay Dubai canal towers night",
  jlt: "JLT Jumeirah Lake Towers Dubai cluster",
  difc: "DIFC Dubai International Financial Centre architecture",
  "dubai-hills-estate": "Dubai Hills Estate villa golf course",
  jvc: "Jumeirah Village Circle Dubai community aerial",
  "damac-lagoons": "Dubai luxury villa lagoon Mediterranean",
  "mbr-city": "Dubai Meydan crystal lagoon villa",
  "al-furjan": "Dubai community townhouse residential",
  "sobha-hartland": "Sobha Hartland MBR City Dubai residential",
  "dubai-creek-harbour": "Dubai Creek Harbour aerial waterfront",
  "mina-rashid": "Mina Rashid Dubai marina QE2 waterfront",
  "tilal-al-ghaf": "Dubai villa community crystal lagoon",
  "hudayriyat-island": "Hudayriyat Island Abu Dhabi coastline beach",
  "palm-jebel-ali": "Palm Jebel Ali Dubai aerial fronds construction",
  "wynn-al-marjan": "Al Marjan Island Ras Al Khaimah coastline resort",
  "saadiyat-island": "Saadiyat Island Abu Dhabi Louvre beach",
  "yas-island": "Yas Island Abu Dhabi F1 circuit aerial",
  "al-reem-island": "Al Reem Island Abu Dhabi towers waterfront",
  "al-maryah-island": "Al Maryah Island Abu Dhabi ADGM Galleria",
  "al-raha-beach": "Abu Dhabi Al Raha Beach waterfront residential",
  "masdar-city": "Masdar City Abu Dhabi sustainable architecture",
  "al-reef": "Abu Dhabi villa community desert",
  "al-marjan-island": "Al Marjan Island Ras Al Khaimah aerial",
  "mina-al-arab": "Ras Al Khaimah coastline waterfront resort",
  "al-hamra-village": "Al Hamra Village Ras Al Khaimah marina golf",
  // ── Added so niche subjects map to a SPECIFIC UAE query (otherwise they
  //    fell through to a generic category query that returned wrong-country
  //    photos via the Wikimedia search). ──
  "al-barari": "Dubai Al Barari green villa community aerial",
  "arabian-ranches": "Arabian Ranches Dubai villa community",
  "emaar-beachfront": "Dubai Harbour Emaar Beachfront towers waterfront",
  "the-valley": "Dubai Emaar The Valley community aerial",
  "jumeirah-golf-estates": "Jumeirah Golf Estates Dubai golf villas",
  "emirates-hills": "Emirates Hills Dubai luxury villas lake",
  "district-one": "Mohammed Bin Rashid City Dubai crystal lagoon",
  "dubai-islands": "Dubai Islands waterfront beach aerial",
  "bluewaters-island": "Bluewaters Island Dubai Ain Dubai aerial",
  "jumeirah-bay-island": "Jumeirah Bay Island Dubai aerial",
  "port-de-la-mer": "Port de la Mer La Mer Dubai marina",
  "dubai-maritime-city": "Dubai Maritime City waterfront skyline",
  "jumeirah-village-circle": "Jumeirah Village Circle Dubai aerial",
  "saadiyat-reserve": "Saadiyat Island Abu Dhabi villas reserve",
  "jubail-island": "Jubail Island Abu Dhabi mangroves aerial",
  "nareel-island": "Nareel Island Abu Dhabi waterfront",
  "yas-acres": "Yas Island Abu Dhabi aerial",
  "burj-khalifa": "Burj Khalifa Downtown Dubai skyline",
  "ain-dubai": "Ain Dubai Bluewaters Island Dubai",
  "louvre-abu-dhabi": "Louvre Abu Dhabi architecture",
};

const CATEGORY_QUERIES: Record<string, string> = {
  "market-pulse": "Dubai skyline aerial cityscape",
  launch: "Dubai luxury property launch architecture",
  regulatory: "Dubai government building architecture",
  macro: "Dubai cityscape aerial business",
  "developer-corporate": "Dubai corporate office tower",
  infrastructure: "Dubai metro highway infrastructure aerial",
  policy: "Dubai government emirates flag building",
};

/** Build the search query for a given article. */
export function buildQueryForArticle(article: NewsArticle): string {
  // 1. If article references a known developer, prefer that
  const titleLower = article.title.toLowerCase();
  for (const [slug, q] of Object.entries(DEVELOPER_QUERIES)) {
    const devName = slug.replace(/-/g, " ");
    if (titleLower.includes(devName) || titleLower.includes(slug)) {
      return q;
    }
  }

  // 2. Look for a known area mentioned in the article
  for (const [slug, q] of Object.entries(AREA_QUERIES)) {
    const areaName = slug.replace(/-/g, " ");
    if (titleLower.includes(areaName) || titleLower.includes(slug)) {
      return q;
    }
  }

  // 3. Non-Dubai emirates skip the Dubai-centric category queries and use an
  //    emirate-correct generic — so an Abu Dhabi / RAK story never inherits a
  //    Dubai skyline from the category fallback below.
  const emirate = article.market[0]?.toLowerCase() || "dubai";
  if (emirate.includes("abu dhabi")) return "Abu Dhabi skyline corniche aerial";
  if (emirate.includes("ras al khaimah")) return "Ras Al Khaimah coastline resort waterfront";

  // 4. Dubai / UAE — category-based query, else a generic Dubai skyline.
  if (article.category in CATEGORY_QUERIES) {
    return CATEGORY_QUERIES[article.category];
  }
  return "Dubai skyline aerial golden hour";
}

/** Build query for an area page. */
export function buildQueryForArea(slug: string): string {
  return AREA_QUERIES[slug] || `${slug.replace(/-/g, " ")} UAE architecture`;
}

/** Build query for a developer page. */
export function buildQueryForDeveloper(slug: string): string {
  return DEVELOPER_QUERIES[slug] || `${slug.replace(/-/g, " ")} property developer UAE`;
}
