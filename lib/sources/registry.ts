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
  /** False = discovery feed only (e.g. Google News) — surfaces stories but is
   *  never itself a valid citation target. Defaults to true. */
  citable?: boolean;
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

/* ─── Discovery feeds — Google News RSS (the fetch workhorses) ──────────
 *
 * Why: the direct-publisher RSS paths above rot constantly (May 2026: 14/20
 * were 404/403). Google News RSS is standard RSS 2.0 (our parser handles it),
 * never 404s, scopes by query + recency, and tags each item with its REAL
 * publisher via the <source url> element — which the RSS parser lifts so each
 * entry is attributed (and citable) to the actual outlet, not to Google.
 *
 * These are discovery-only (citable:false) — articles cite the underlying
 * publisher (already in SOURCE_WHITELIST), never news.google.com. */

function googleNews(query: string): string {
  // AE locale + 7-day recency window; encodeURIComponent handles operators.
  return `https://news.google.com/rss/search?q=${encodeURIComponent(
    `${query} when:7d`,
  )}&hl=en-AE&gl=AE&ceid=AE:en`;
}

function discovery(name: string, query: string, market: VerifiedSource["market"]): VerifiedSource {
  return {
    name,
    url: "https://news.google.com",
    tier: "national-press",
    market,
    fetchType: "rss",
    rssUrl: googleNews(query),
    citable: false,
  };
}

export const DISCOVERY_FEEDS: VerifiedSource[] = [
  discovery("Dubai real estate", "Dubai real estate", ["Dubai"]),
  discovery("Dubai property market", "Dubai property market price", ["Dubai"]),
  discovery("Dubai off-plan", "Dubai off-plan property launch", ["Dubai"]),
  discovery("Dubai developers", "Emaar OR Nakheel OR Meraas OR Sobha OR Damac Dubai property", ["Dubai"]),
  discovery("Abu Dhabi real estate", "Abu Dhabi real estate Aldar OR Modon", ["Abu Dhabi"]),
  discovery("Hudayriyat / Saadiyat", "Hudayriyat OR Saadiyat island property", ["Abu Dhabi"]),
  discovery("Ras Al Khaimah", "Ras Al Khaimah Wynn Al Marjan real estate", ["Ras Al Khaimah"]),
  discovery("Golden Visa", "UAE Golden Visa property investment", ["UAE"]),
  discovery("DLD transactions", "Dubai Land Department transactions volume", ["Dubai"]),
  discovery("RERA / regulation", "Dubai RERA property regulation mortgage", ["Dubai"]),
  discovery("Branded residences", "Dubai branded residences ultra luxury", ["Dubai"]),
  discovery("UAE rental market", "UAE Dubai rental market rents yield", ["UAE", "Dubai"]),
];

/** What the orchestrator actually pulls from each run. Discovery feeds carry
 *  the load; the citable SOURCE_WHITELIST entries with a live rssUrl are added
 *  for primary-source coverage. (Dead direct feeds stay in SOURCE_WHITELIST as
 *  citation anchors but are not fetched.) */
export const FETCH_SOURCES: VerifiedSource[] = [...DISCOVERY_FEEDS];

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

/** Returns just the citable whitelisted domains for fast bulk-checking.
 *  Discovery feeds (citable:false, e.g. news.google.com) are excluded — an
 *  article cites the underlying publisher, never the aggregator. */
export function getWhitelistDomains(): string[] {
  return SOURCE_WHITELIST.filter((s) => s.citable !== false).map((s) =>
    new URL(s.url).hostname.replace("www.", ""),
  );
}
