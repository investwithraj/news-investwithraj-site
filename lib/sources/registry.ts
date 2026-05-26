// Verified-source whitelist — hard gate for every drafted article.
// Every article must cite ≥1 source from this registry. Non-whitelisted
// sources cannot satisfy the citation requirement (see validator.ts).
//
// Maintained by Claude via the news pipeline. To add a new source:
// append to SOURCE_WHITELIST + push. Removals require explicit user
// approval — never auto-drop.

export type SourceTier = "government" | "national-press" | "regional-press" | "institutional-research" | "industry-portal";

export type SourceFetchType = "rss" | "webfetch" | "scrape";

export interface VerifiedSource {
  /** Display name for inline attribution */
  name: string;
  /** Canonical homepage URL — also the domain anchor for citation matching */
  url: string;
  /** Tier — drives editorial weight (gov + national press = highest) */
  tier: SourceTier;
  /** Geography it primarily covers — informs UHNW relevance scoring */
  market: ("Dubai" | "Abu Dhabi" | "Ras Al Khaimah" | "UAE" | "GCC" | "Global")[];
  /** How the pipeline pulls from it */
  fetchType: SourceFetchType;
  /** RSS feed URL when fetchType === "rss" */
  rssUrl?: string;
  /** Optional notes for the pipeline (e.g. paywall, scrape-rate-limit) */
  notes?: string;
}

/**
 * The 20-source verified-source whitelist for the news firehose pipeline.
 * Mirrors master plan Part 3f. Ordered by tier weight (gov first).
 */
export const SOURCE_WHITELIST: VerifiedSource[] = [
  /* ─── Tier 1 · Government / regulator (7) ──────────────────────── */
  {
    name: "Dubai Land Department",
    url: "https://dubailand.gov.ae",
    tier: "government",
    market: ["Dubai"],
    fetchType: "webfetch",
    notes: "DLD transaction data via dxbinteract.com proxy + DLD open-data CSV exports.",
  },
  {
    name: "RERA",
    url: "https://www.rera.gov.ae",
    tier: "government",
    market: ["Dubai"],
    fetchType: "webfetch",
    notes: "RERA bulletins via rera.gov.ae press feed.",
  },
  {
    name: "Dubai Statistics Center",
    url: "https://www.dsc.gov.ae",
    tier: "government",
    market: ["Dubai"],
    fetchType: "webfetch",
    notes: "DSC quarterly releases.",
  },
  {
    name: "Federal Competitiveness & Statistics Authority",
    url: "https://fcsc.gov.ae",
    tier: "government",
    market: ["UAE"],
    fetchType: "webfetch",
    notes: "FCSC national statistics.",
  },
  {
    name: "Central Bank of the UAE",
    url: "https://www.centralbank.ae",
    tier: "government",
    market: ["UAE"],
    fetchType: "webfetch",
    notes: "CBUAE press releases + monetary stats.",
  },
  {
    name: "Abu Dhabi Global Market",
    url: "https://www.adgm.com",
    tier: "government",
    market: ["Abu Dhabi"],
    fetchType: "webfetch",
    notes: "ADGM newsroom.",
  },
  {
    name: "Dubai International Financial Centre",
    url: "https://www.difc.com",
    tier: "government",
    market: ["Dubai"],
    fetchType: "webfetch",
    notes: "DIFC newsroom.",
  },

  /* ─── Tier 2 · National press (4) ──────────────────────────────── */
  {
    name: "Khaleej Times — Real Estate",
    url: "https://www.khaleejtimes.com/real-estate",
    tier: "national-press",
    market: ["UAE", "Dubai", "Abu Dhabi"],
    fetchType: "rss",
    rssUrl: "https://www.khaleejtimes.com/rss/real-estate",
  },
  {
    name: "Gulf News — Property",
    url: "https://gulfnews.com/business/property",
    tier: "national-press",
    market: ["UAE", "Dubai", "Abu Dhabi"],
    fetchType: "rss",
    rssUrl: "https://gulfnews.com/rss/property",
  },
  {
    name: "The National — Business",
    url: "https://www.thenationalnews.com/business",
    tier: "national-press",
    market: ["UAE", "Abu Dhabi"],
    fetchType: "rss",
    rssUrl: "https://www.thenationalnews.com/business/rss.xml",
  },
  {
    name: "Arabian Business",
    url: "https://www.arabianbusiness.com",
    tier: "national-press",
    market: ["UAE", "GCC"],
    fetchType: "rss",
    rssUrl: "https://www.arabianbusiness.com/feed",
  },

  /* ─── Tier 3 · Regional press (2) ──────────────────────────────── */
  {
    name: "Zawya — Real Estate (LSEG)",
    url: "https://www.zawya.com/en/business/real-estate",
    tier: "regional-press",
    market: ["GCC", "UAE"],
    fetchType: "rss",
    rssUrl: "https://www.zawya.com/en/rss/business/real-estate",
  },
  {
    name: "Mubasher",
    url: "https://english.mubasher.info",
    tier: "regional-press",
    market: ["GCC"],
    fetchType: "rss",
    rssUrl: "https://english.mubasher.info/rss",
  },

  /* ─── Tier 4 · Institutional research (5) ──────────────────────── */
  {
    name: "Knight Frank Dubai",
    url: "https://www.knightfrank.com/research/region/uae",
    tier: "institutional-research",
    market: ["UAE", "Dubai", "Abu Dhabi"],
    fetchType: "webfetch",
    notes: "Quarterly Wealth Report + Dubai Residential Insight PDFs.",
  },
  {
    name: "JLL MENA",
    url: "https://www.jll-mena.com/en/trends-and-insights",
    tier: "institutional-research",
    market: ["UAE", "GCC"],
    fetchType: "webfetch",
    notes: "JLL Dubai + Abu Dhabi quarterly reports.",
  },
  {
    name: "CBRE MENA",
    url: "https://www.cbre.ae/insights",
    tier: "institutional-research",
    market: ["UAE", "Dubai"],
    fetchType: "webfetch",
    notes: "CBRE quarterly Dubai office + residential reports.",
  },
  {
    name: "Savills Dubai",
    url: "https://www.savills.ae/research_articles.aspx",
    tier: "institutional-research",
    market: ["Dubai"],
    fetchType: "webfetch",
    notes: "Savills Dubai market view + Spotlight reports.",
  },
  {
    name: "Asteco",
    url: "https://www.asteco.com/research-reports",
    tier: "institutional-research",
    market: ["UAE"],
    fetchType: "webfetch",
    notes: "Asteco quarterly UAE residential + commercial reports.",
  },

  /* ─── Tier 5 · Industry portals (2) ────────────────────────────── */
  {
    name: "Property Finder Trends",
    url: "https://www.propertyfinder.ae/blog/trends-insights",
    tier: "industry-portal",
    market: ["UAE", "Dubai"],
    fetchType: "rss",
    rssUrl: "https://www.propertyfinder.ae/blog/feed",
  },
  {
    name: "Bayut Insights (mybayut)",
    url: "https://www.bayut.com/mybayut",
    tier: "industry-portal",
    market: ["UAE", "Dubai", "Abu Dhabi"],
    fetchType: "rss",
    rssUrl: "https://www.bayut.com/mybayut/feed",
  },
];

/** Per-tier weight for ranking which articles to draft first.
 *  Higher weight → article scored higher in the daily cluster ranking. */
export const TIER_WEIGHT: Record<SourceTier, number> = {
  government: 1.0,
  "national-press": 0.85,
  "institutional-research": 0.80,
  "regional-press": 0.65,
  "industry-portal": 0.50,
};

/** Lookup a source by its domain (after stripping `www.` + path). */
export function findSourceByUrl(url: string): VerifiedSource | undefined {
  try {
    const host = new URL(url).hostname.replace("www.", "");
    return SOURCE_WHITELIST.find((s) => {
      const sHost = new URL(s.url).hostname.replace("www.", "");
      return host === sHost || host.endsWith(`.${sHost}`);
    });
  } catch {
    return undefined;
  }
}

/** Returns just the whitelisted domains for fast bulk-checking. */
export function getWhitelistDomains(): string[] {
  return SOURCE_WHITELIST.map((s) =>
    new URL(s.url).hostname.replace("www.", "")
  );
}
