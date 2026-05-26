// Developer registry — UAE real-estate developers covered by news.investwithraj.com.
// Each entry powers /developer/[slug]: profile + market position + recent
// news feed + project list + Raj's take on credit + delivery track record.

export type DeveloperKind =
  | "sovereign-master"  // Modon, Aldar, Nakheel (ADX/DFM-listed, sovereign-backed)
  | "listed-developer"  // Emaar, Damac, Aldar, Sobha (listed, public)
  | "private-major"     // Meraas, Dubai Holding, IFA
  | "private-active"    // Binghatti, Azizi, Danube, Tiger, Object 1
  | "boutique"          // Omniyat, Ellington, Select Group
  | "anchor-tenant";    // Wynn Resorts, Marjan

export interface DeveloperProfile {
  /** URL slug at /developer/{slug} — kebab-case */
  slug: string;
  /** Display name */
  name: string;
  /** 1-line tagline */
  tagline: string;
  /** Founded year */
  founded?: number;
  /** HQ emirate */
  hq: "Dubai" | "Abu Dhabi" | "Ras Al Khaimah" | "Sharjah" | "United States";
  /** Kind */
  kind: DeveloperKind;
  /** ADX/DFM ticker if listed */
  ticker?: string;
  /** Standfirst paragraph */
  excerpt: string;
  /** Areas they're active in — slugs from content/areas */
  activeAreas: string[];
  /** Flagship projects */
  flagshipProjects: string[];
  /** Brand accent — used on the per-developer page */
  accent: string;
  /** Single-glyph mark */
  glyph: string;
  /** Raj's quick-take on credit + delivery */
  rajTake: string;
}

export const DEVELOPERS: DeveloperProfile[] = [
  {
    slug: "emaar",
    name: "Emaar Properties",
    tagline: "Dubai's reference developer. Downtown, Dubai Hills, Dubai Marina, Creek Harbour.",
    founded: 1997,
    hq: "Dubai",
    kind: "listed-developer",
    ticker: "DFM:EMAAR",
    excerpt: "Emaar is the UAE's largest listed developer by revenue. Downtown Dubai is its flagship. Dubai Hills, Dubai Marina, Arabian Ranches, Dubai Creek Harbour, Mina Rashid — most of Dubai's institutional-grade product traces back here. Strong delivery record, premium pricing, the comp for everyone else.",
    activeAreas: ["downtown-dubai", "dubai-marina", "dubai-hills-estate", "dubai-creek-harbour", "mina-rashid"],
    flagshipProjects: ["Burj Khalifa", "Address Sky View", "Dubai Mall", "Creek Tower", "Dubai Hills Estate"],
    accent: "var(--gold-deep)",
    glyph: "◆",
    rajTake: "Premium pricing reflects premium delivery. Pay the spread for the certainty.",
  },
  {
    slug: "aldar",
    name: "Aldar Properties",
    tagline: "Abu Dhabi's #1. Saadiyat, Yas, Al Raha, Al Reem core. Mubadala backed.",
    founded: 2004,
    hq: "Abu Dhabi",
    kind: "listed-developer",
    ticker: "ADX:ALDAR",
    excerpt: "Aldar is Abu Dhabi's flagship listed developer — sovereign-backed via Mubadala (28%+ stake). Saadiyat Island, Yas Island, Al Raha Beach, Al Reem Island are all Aldar. The institutional address in the UAE capital.",
    activeAreas: ["saadiyat-island", "yas-island", "al-reem-island", "al-raha-beach"],
    flagshipProjects: ["Saadiyat Reserve", "Yas Acres", "The Bridges", "Al Maryah Vista"],
    accent: "var(--ink)",
    glyph: "▣",
    rajTake: "Sovereign-backed delivery and the AD market's most disciplined absorption. Lower yield than Dubai, higher certainty.",
  },
  {
    slug: "nakheel",
    name: "Nakheel",
    tagline: "Master-planner of the Palms. Dubai Holding-owned. Palm Jebel Ali relaunch is the catalyst.",
    founded: 2000,
    hq: "Dubai",
    kind: "sovereign-master",
    excerpt: "Nakheel is Dubai's master-planner — Palm Jumeirah, The World, Deira Islands, Palm Jebel Ali (relaunched 2023). Owned by Dubai Holding via the 2024 Meydan + Nakheel + Meraas merger. Sovereign-backed, slow but heavyweight.",
    activeAreas: ["palm-jumeirah", "palm-jebel-ali", "al-furjan"],
    flagshipProjects: ["Palm Jumeirah", "Palm Jebel Ali", "Deira Islands", "Discovery Gardens"],
    accent: "var(--gold-rich)",
    glyph: "❀",
    rajTake: "PJA relaunch is the structural re-rating story. Discounts to Palm Jumeirah still hold at 40%+ on equivalent product.",
  },
  {
    slug: "modon",
    name: "Modon Properties",
    tagline: "Abu Dhabi sovereign-master. Hudayriyat #1 island, Reem Hills, Wadi Al Safa.",
    founded: 2018,
    hq: "Abu Dhabi",
    kind: "sovereign-master",
    ticker: "ADX:MODON",
    excerpt: "Modon is Abu Dhabi's sovereign-backed master-developer — 58.1% government-owned via ADQ. Hudayriyat Island is its flagship (Q1 2026 #1 in AD by transaction volume). Surf Abu Dhabi, the Velodrome, Circuit X, Golf Estates are all Modon.",
    activeAreas: ["hudayriyat-island"],
    flagshipProjects: ["Hudayriyat Island", "Surf Abu Dhabi", "Golf Estates", "Reem Hills"],
    accent: "var(--navy)",
    glyph: "◈",
    rajTake: "Government-backed delivery + thematic islands. The sovereign master-plan thesis lives here.",
  },
  {
    slug: "damac",
    name: "Damac Properties",
    tagline: "Volume engine. Damac Hills, Damac Lagoons, Business Bay pipeline.",
    founded: 2002,
    hq: "Dubai",
    kind: "private-major",
    excerpt: "Damac was DFM-listed before the 2022 take-private by founder Hussain Sajwani. High-volume launch cadence, Damac Hills + Damac Lagoons villa masterplans, branded residences with Cavalli / De Grisogono / Versace partnerships.",
    activeAreas: ["business-bay", "damac-lagoons", "dubai-marina"],
    flagshipProjects: ["Damac Hills", "Damac Lagoons", "Cavalli Tower", "AYKON City"],
    accent: "var(--gold-deep)",
    glyph: "✦",
    rajTake: "Aggressive marketing, deep launch pipeline. Read the payment plan carefully — the hand-over math is the trade.",
  },
  {
    slug: "sobha",
    name: "Sobha Realty",
    tagline: "Single-developer masterplan operator. Hartland I + II + III. Higher build quality.",
    founded: 1976,
    hq: "Dubai",
    kind: "private-major",
    excerpt: "Sobha Realty is the UAE arm of India's Sobha Group — Hartland masterplan in MBR City is the flagship. Known for higher build-quality than the volume developers; single-developer control over masterplans is the structural advantage.",
    activeAreas: ["sobha-hartland", "business-bay", "mbr-city"],
    flagshipProjects: ["Sobha Hartland", "Sobha Hartland II", "Hartland Estates", "Sobha One"],
    accent: "var(--gold-rich)",
    glyph: "◐",
    rajTake: "Pay the premium for the build quality. Hartland's single-developer control = no neighbor risk.",
  },
  {
    slug: "dubai-holding",
    name: "Dubai Holding",
    tagline: "Sovereign holding. Nakheel + Meraas + Meydan + DPG merger umbrella. Madinat Jumeirah operator.",
    founded: 2004,
    hq: "Dubai",
    kind: "sovereign-master",
    excerpt: "Dubai Holding is the Dubai government's sovereign holding company — post the 2024 merger, it now controls Nakheel, Meraas, Meydan, Dubai Properties Group, Jumeirah Group. The mega-development arm of the Dubai sovereign apparatus.",
    activeAreas: ["mbr-city", "jbr", "business-bay"],
    flagshipProjects: ["Madinat Jumeirah Living", "City Walk", "Bluewaters", "Port de La Mer"],
    accent: "var(--navy)",
    glyph: "❖",
    rajTake: "Sovereign delivery cadence — slower than private, but the brand portfolio gives Dubai its luxury anchor.",
  },
  {
    slug: "ifa-hotels",
    name: "IFA Hotels & Resorts",
    tagline: "Branded-residence specialist. Fairmont Palm, Anantara, IFA-Modon Hudayriyat partnership.",
    founded: 1995,
    hq: "Dubai",
    kind: "private-major",
    excerpt: "IFA is the UAE branded-residence specialist — Fairmont Palm, Anantara Eastern Mangroves, Raffles Palm. Strategic JV partner to Modon on Hudayriyat Golf Estates (Note 03 thesis). Long-cycle product, hotel-operator brand premium.",
    activeAreas: ["palm-jumeirah", "hudayriyat-island"],
    flagshipProjects: ["Fairmont Palm", "Anantara Palm", "Raffles The Palm", "Hudayriyat Golf Estates"],
    accent: "var(--gold-deep)",
    glyph: "❋",
    rajTake: "Branded residence operator with hotel-discipline on amenity. Yield holds when the hotel name carries.",
  },
  {
    slug: "marjan",
    name: "Marjan / RAK Holding",
    tagline: "Ras Al Khaimah's master-developer. Wynn Al Marjan anchor. Sovereign-backed.",
    founded: 2003,
    hq: "Ras Al Khaimah",
    kind: "sovereign-master",
    excerpt: "Marjan is RAK's sovereign-backed master-developer for Al Marjan Island — Wynn Resorts $3.9B / 1,500-key opening 2027 is the catalyst. Integrated-resort licence is the entire thesis on RAK rerating.",
    activeAreas: ["wynn-al-marjan", "al-marjan-island"],
    flagshipProjects: ["Al Marjan Island", "Wynn Al Marjan (anchor tenant)", "Marjan Bay"],
    accent: "var(--gold-rich)",
    glyph: "✺",
    rajTake: "Anchored to the Wynn catalyst. The 2027 opening is the rerating moment.",
  },
];

export function getDeveloperBySlug(slug: string): DeveloperProfile | null {
  return DEVELOPERS.find((d) => d.slug === slug) ?? null;
}

export function getAllDeveloperSlugs(): string[] {
  return DEVELOPERS.map((d) => d.slug);
}

/** Find developers active in a given area slug. */
export function getDevelopersForArea(areaSlug: string): DeveloperProfile[] {
  return DEVELOPERS.filter((d) => d.activeAreas.includes(areaSlug));
}
