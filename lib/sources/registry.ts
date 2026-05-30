// Verified-source whitelist — hard gate for every drafted article.
// Every article must cite ≥1 source from this registry. Non-whitelisted
// sources cannot satisfy the citation requirement (see validator.ts).
//
// Maintained by Claude via the news pipeline. To add a new source:
// append to SOURCE_WHITELIST + push. Removals require explicit user
// approval — never auto-drop.

export type SourceTier = "government" | "national-press" | "regional-press" | "institutional-research" | "industry-portal";

export type SourceFetchType = "rss" | "webfetch" | "scrape" | "reddit";

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

  /* ─── Citation anchors (not fetched directly — surfaced via aggregators /
   *     Claude web-search; listed so their cited URLs pass validator gate 5) ── */
  { name: "AGBI", url: "https://www.agbi.com", tier: "national-press", market: ["UAE", "GCC"], fetchType: "webfetch" },
  { name: "Gulf Business", url: "https://gulfbusiness.com", tier: "national-press", market: ["UAE", "GCC"], fetchType: "webfetch" },
  { name: "Construction Week", url: "https://www.constructionweekonline.com", tier: "regional-press", market: ["UAE"], fetchType: "webfetch" },
  { name: "MEED", url: "https://www.meed.com", tier: "institutional-research", market: ["UAE", "GCC"], fetchType: "webfetch" },
  { name: "Emirates 24|7", url: "https://www.emirates247.com", tier: "regional-press", market: ["UAE"], fetchType: "webfetch" },
  { name: "Gulf Today", url: "https://www.gulftoday.ae", tier: "regional-press", market: ["UAE"], fetchType: "webfetch" },
  { name: "WAM (Emirates News Agency)", url: "https://www.wam.ae", tier: "government", market: ["UAE"], fetchType: "webfetch" },
  { name: "ValuStrat", url: "https://www.valustrat.com", tier: "institutional-research", market: ["UAE"], fetchType: "webfetch" },
  { name: "Cavendish Maxwell", url: "https://www.cavendishmaxwell.com", tier: "institutional-research", market: ["UAE"], fetchType: "webfetch" },
  { name: "Property Monitor", url: "https://www.propertymonitor.ae", tier: "institutional-research", market: ["Dubai"], fetchType: "webfetch" },
  { name: "Reidin", url: "https://www.reidin.com", tier: "institutional-research", market: ["UAE"], fetchType: "webfetch" },
  { name: "dxbinteract", url: "https://dxbinteract.com", tier: "industry-portal", market: ["Dubai"], fetchType: "webfetch" },
  { name: "Dubai Pulse (open data)", url: "https://www.dubaipulse.gov.ae", tier: "government", market: ["Dubai"], fetchType: "webfetch" },
  { name: "Emaar Properties", url: "https://www.emaar.com", tier: "industry-portal", market: ["Dubai"], fetchType: "webfetch" },
  { name: "Nakheel", url: "https://www.nakheel.com", tier: "industry-portal", market: ["Dubai"], fetchType: "webfetch" },
  { name: "Aldar Properties", url: "https://www.aldar.com", tier: "industry-portal", market: ["Abu Dhabi"], fetchType: "webfetch" },
  { name: "Modon Properties", url: "https://www.modon.ae", tier: "industry-portal", market: ["Abu Dhabi"], fetchType: "webfetch" },
  { name: "Sobha Realty", url: "https://www.sobharealty.com", tier: "industry-portal", market: ["Dubai"], fetchType: "webfetch" },
  { name: "Damac Properties", url: "https://www.damacproperties.com", tier: "industry-portal", market: ["Dubai"], fetchType: "webfetch" },
  { name: "Meraas", url: "https://www.meraas.com", tier: "industry-portal", market: ["Dubai"], fetchType: "webfetch" },
  { name: "Binghatti", url: "https://www.binghatti.com", tier: "industry-portal", market: ["Dubai"], fetchType: "webfetch" },
  { name: "Azizi Developments", url: "https://www.azizidevelopments.com", tier: "industry-portal", market: ["Dubai"], fetchType: "webfetch" },
  { name: "Danube Properties", url: "https://www.danubeproperties.com", tier: "industry-portal", market: ["Dubai"], fetchType: "webfetch" },
  { name: "Ellington Properties", url: "https://ellingtonproperties.ae", tier: "industry-portal", market: ["Dubai"], fetchType: "webfetch" },
  { name: "Reuters", url: "https://www.reuters.com", tier: "national-press", market: ["Global"], fetchType: "webfetch" },
  { name: "Bloomberg", url: "https://www.bloomberg.com", tier: "national-press", market: ["Global"], fetchType: "webfetch" },
  { name: "Financial Times", url: "https://www.ft.com", tier: "national-press", market: ["Global"], fetchType: "webfetch" },
  { name: "CNBC", url: "https://www.cnbc.com", tier: "national-press", market: ["Global"], fetchType: "webfetch" },
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

function bingNews(query: string): string {
  return `https://www.bing.com/news/search?q=${encodeURIComponent(query)}&format=rss&qft=interval%3d%227%22`;
}

function discovery(
  name: string,
  query: string,
  market: VerifiedSource["market"],
  engine: "google" | "bing" = "google",
): VerifiedSource {
  return {
    name: `${engine === "bing" ? "Bing" : "Google"} News · ${name}`,
    url: engine === "bing" ? "https://www.bing.com" : "https://news.google.com",
    tier: "national-press",
    market,
    fetchType: "rss",
    rssUrl: engine === "bing" ? bingNews(query) : googleNews(query),
    citable: false,
  };
}

// Topic/entity queries run through BOTH aggregators (Google primary, Bing
// secondary) — broad net, never 404, real per-entry publisher attribution.
const GOOGLE_QUERIES: [string, string, VerifiedSource["market"]][] = [
  ["Dubai real estate", "Dubai real estate", ["Dubai"]],
  ["Dubai property market", "Dubai property market price index", ["Dubai"]],
  ["Dubai off-plan", "Dubai off-plan property launch", ["Dubai"]],
  ["Dubai luxury / branded", "Dubai branded residences ultra-luxury penthouse villa", ["Dubai"]],
  ["Dubai developers", "Emaar OR Nakheel OR Meraas OR Sobha OR Damac OR Azizi Dubai property", ["Dubai"]],
  ["Dubai new launches", "Dubai property launch new tower community", ["Dubai"]],
  ["Abu Dhabi real estate", "Abu Dhabi real estate Aldar OR Modon OR Q Properties", ["Abu Dhabi"]],
  ["Hudayriyat / Saadiyat / Yas", "Hudayriyat OR Saadiyat OR Yas Island property Abu Dhabi", ["Abu Dhabi"]],
  ["Ras Al Khaimah / Wynn", "Ras Al Khaimah Wynn Al Marjan Island real estate", ["Ras Al Khaimah"]],
  ["Golden Visa", "UAE Golden Visa property investment residency", ["UAE"]],
  ["DLD transactions", "Dubai Land Department transactions volume value", ["Dubai"]],
  ["RERA / regulation", "Dubai RERA property regulation escrow oqood", ["Dubai"]],
  ["Mortgage / lending", "UAE mortgage property lending interest rate LTV", ["UAE", "Dubai"]],
  ["Rental market / yield", "Dubai rental market rents yield gross", ["Dubai"]],
  ["Secondary / resale", "Dubai secondary market resale ready property", ["Dubai"]],
  ["Waterfront / islands", "Dubai waterfront beachfront island property", ["Dubai"]],
  ["Plots / land", "Dubai Abu Dhabi residential plot land freehold", ["Dubai", "Abu Dhabi"]],
  ["REIT / institutional", "UAE real estate REIT institutional fund investment", ["UAE"]],
  ["PropTech / tokenisation", "Dubai real estate tokenisation PropTech VARA blockchain", ["Dubai"]],
  ["Developer earnings", "Emaar OR Aldar OR Damac results earnings revenue", ["UAE"]],
];

const BING_QUERIES: [string, string, VerifiedSource["market"]][] = [
  ["Dubai real estate", "Dubai real estate property", ["Dubai"]],
  ["Abu Dhabi real estate", "Abu Dhabi real estate property", ["Abu Dhabi"]],
  ["UAE Golden Visa property", "UAE Golden Visa property investment", ["UAE"]],
  ["Dubai luxury property", "Dubai luxury branded residences", ["Dubai"]],
];

export const DISCOVERY_FEEDS: VerifiedSource[] = [
  ...GOOGLE_QUERIES.map(([n, q, m]) => discovery(n, q, m, "google")),
  ...BING_QUERIES.map(([n, q, m]) => discovery(n, q, m, "bing")),
];

/** AGBI — Arabian Gulf Business Insight. Verified live RSS (one of the few
 *  direct publisher feeds that still works). Citable + fetched. */
const AGBI: VerifiedSource = {
  name: "AGBI — Arabian Gulf Business Insight",
  url: "https://www.agbi.com",
  tier: "national-press",
  market: ["UAE", "GCC"],
  fetchType: "rss",
  rssUrl: "https://www.agbi.com/feed/",
};

/** Reddit communities — DISABLED: Reddit now 403s unauthenticated JSON from
 *  datacenter IPs (needs OAuth). The fetcher (`fetchers/reddit.ts`) + the
 *  "reddit" fetchType stay wired for a future OAuth credential; not fetched
 *  for now to avoid guaranteed errors each run. */
export const REDDIT_FEEDS: VerifiedSource[] = [
  { name: "Reddit · r/dubai", url: "https://www.reddit.com/r/dubai", tier: "industry-portal", market: ["Dubai"], fetchType: "reddit", rssUrl: "https://www.reddit.com/r/dubai/search.json?q=real%20estate%20OR%20property&restrict_sr=1&sort=new&t=week&limit=15", citable: false },
];

/** What the orchestrator pulls each run: both aggregators + AGBI. Claude
 *  web-search supplies full-text depth at draft time (see the cron). */
export const FETCH_SOURCES: VerifiedSource[] = [
  ...DISCOVERY_FEEDS,
  AGBI,
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

/** Returns just the citable whitelisted domains for fast bulk-checking.
 *  Discovery feeds (citable:false, e.g. news.google.com) are excluded — an
 *  article cites the underlying publisher, never the aggregator. */
export function getWhitelistDomains(): string[] {
  return SOURCE_WHITELIST.filter((s) => s.citable !== false).map((s) =>
    new URL(s.url).hostname.replace("www.", ""),
  );
}
