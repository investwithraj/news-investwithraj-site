// Clustering + scoring. Groups deduplicated entries by topic/entity and
// scores each cluster on UHNW relevance × source tier × freshness × Raj
// coverage angle, returning the top-N for drafting.

import type { RawEntry } from "@/lib/sources/fetchers";
import type { Cluster, ClusterEntities } from "./types";
import { TIER_WEIGHT } from "@/lib/sources/registry";
import { similarity } from "./dedupe";

/* ─── Entity dictionaries ──────────────────────────────────────────────
   These are the named entities Raj's audience cares about. Extending
   these expands coverage; pruning narrows it. Keep maintained as the
   site evolves. */

const KNOWN_DEVELOPERS = [
  "Modon",
  "Nakheel",
  "Emaar",
  "Aldar",
  "Damac",
  "Sobha",
  "Meraas",
  "Q Properties",
  "Wynn Resorts",
  "Dubai Holding",
  "Imkan",
  "Reportage",
  "Eagle Hills",
  "Azizi",
  "Ellington",
  "Select Group",
  "Sweid",
  "MAG",
  "Binghatti",
  "Danube",
  "Object 1",
  "Samana",
  "Imtiaz",
  "LEOS",
  "Omniyat",
  "Arada",
  "Bloom Holding",
  "Tiger Group",
  "Expo City",
  "Dubai South",
  "Wasl",
  "Deyaar",
  "Union Properties",
];

// SPECIFIC places only — generic emirate names live in GENERIC_PLACES below
// and are deliberately NOT used as clustering signatures (they'd collapse
// every Dubai story into one mega-bucket).
const KNOWN_PLACES = [
  "Hudayriyat",
  "Hudayriyat Island",
  "Palm Jebel Ali",
  "Palm Jumeirah",
  "Saadiyat",
  "Yas Island",
  "Al Marjan",
  "Al Marjan Island",
  "Downtown Dubai",
  "Dubai Marina",
  "Business Bay",
  "JVC",
  "Jumeirah Village Circle",
  "JVT",
  "Jumeirah Village Triangle",
  "DIFC",
  "Sheikh Zayed Road",
  "Dubai Hills",
  "Dubai Hills Estate",
  "Emirates Hills",
  "MBR City",
  "Mohammed Bin Rashid City",
  "Bluewaters",
  "Damac Hills",
  "Damac Lagoons",
  "Reem Island",
  "Al Reem",
  "Al Raha",
  "Masdar City",
  "Al Barari",
  "Tilal Al Ghaf",
  "Jumeirah Golf Estates",
  "Dubai Creek Harbour",
  "Emaar Beachfront",
  "Rashid Yachts",
  "Arabian Ranches",
  "The Valley",
  "The Oasis",
  "Saadiyat Reserve",
  "Jubail Island",
  "Nareel Island",
  "Dubai Islands",
  "City Walk",
  "Jumeirah Bay Island",
  "District One",
  "Sobha Hartland",
  "Al Furjan",
  "Discovery Gardens",
  "Dubai Marina",
  "Madinat Jumeirah Living",
  "Dubai Maritime City",
  "Expo City",
  "Dubai Production City",
  "Dubai Sports City",
  "Town Square",
];

// Generic emirate/city names — used for market detection + scoring, but NEVER
// as a clustering signature (otherwise everything mentioning "Dubai" merges).
const GENERIC_PLACES = new Set([
  "dubai",
  "abu dhabi",
  "ras al khaimah",
  "rak",
  "uae",
  "sharjah",
  "ajman",
]);

const UHNW_KEYWORDS = [
  "luxury",
  "ultra-luxury",
  "branded residence",
  "branded residences",
  "penthouse",
  "mansion",
  "villa",
  "family office",
  "private wealth",
  "ultra high net worth",
  "uhnw",
  "investor",
  "off-plan",
  "golf community",
  "waterfront",
  "beachfront",
  "trophy asset",
  "AED 10M",
  "AED 20M",
  "AED 50M",
  "AED 100M",
  "$10 million",
  "$50 million",
];

const RAJ_ANGLE_KEYWORDS = [
  "yield",
  "absorption",
  "transaction volume",
  "DLD",
  "RERA",
  "payment plan",
  "ROI",
  "IRR",
  "mandate",
  "Golden Visa",
  "cross-border",
  "off-plan",
  "secondary market",
  "resale",
  "launch",
  "handover",
  "discount",
  "escrow",
];

/* ─── Entity extraction ──────────────────────────────────────────────── */

function extractEntities(entries: RawEntry[]): ClusterEntities {
  const text = entries
    .map((e) => `${e.title}\n${e.summary}`)
    .join("\n")
    .toLowerCase();

  const developers = KNOWN_DEVELOPERS.filter((d) =>
    text.includes(d.toLowerCase())
  );
  const places = KNOWN_PLACES.filter((p) => text.includes(p.toLowerCase()));

  // Money figures — match "AED 4.25M", "$3.9B", "AED 11.97 billion" patterns
  const figureRe = /(AED|aed|USD|usd|\$|€)\s*\d+(?:[.,]\d+)?\s*(?:M|B|K|million|billion|thousand)\b/g;
  const figuresRaw = entries
    .flatMap((e) => [...(e.title.matchAll(figureRe) || []), ...(e.summary.matchAll(figureRe) || [])])
    .map((m) => m[0]);
  const figures = [...new Set(figuresRaw)];

  const hasTier1Source = entries.some((e) => e.source.tier === "government");

  return { developers, places, figures, hasTier1Source };
}

/* ─── Clustering ─────────────────────────────────────────────────────── */

/** Pick a cluster signature — the primary entity that defines the topic */
function signatureFor(entry: RawEntry): string | null {
  const text = `${entry.title} ${entry.summary}`.toLowerCase();

  // Prefer specific place + developer combos (most editorial-actionable).
  // Generic emirate names are skipped — they'd collapse every story into one
  // mega-cluster (the "place--dubai" bug).
  for (const place of KNOWN_PLACES) {
    if (GENERIC_PLACES.has(place.toLowerCase())) continue;
    if (text.includes(place.toLowerCase())) {
      for (const dev of KNOWN_DEVELOPERS) {
        if (text.includes(dev.toLowerCase())) {
          return `${dev.toLowerCase().replace(/\s+/g, "-")}--${place
            .toLowerCase()
            .replace(/\s+/g, "-")}`;
        }
      }
      return `place--${place.toLowerCase().replace(/\s+/g, "-")}`;
    }
  }

  // Fallback: developer alone
  for (const dev of KNOWN_DEVELOPERS) {
    if (text.includes(dev.toLowerCase())) {
      return `dev--${dev.toLowerCase().replace(/\s+/g, "-")}`;
    }
  }

  // Generic regulatory / macro buckets
  if (text.includes("rera") || text.includes("dld")) return "regulatory";
  if (text.includes("central bank") || text.includes("interest rate")) return "macro";
  if (text.includes("golden visa") || text.includes("residency")) return "policy";

  return null;
}

/** Determine the suggested news category from cluster content */
function categorizeCluster(entries: RawEntry[]): Cluster["suggestedCategory"] {
  const text = entries.map((e) => e.title).join(" ").toLowerCase();
  if (/\b(launch|launches|launched|opening|debut|unveil)\b/.test(text)) return "launch";
  if (/\b(rera|dld|regulation|regulator|fine|penalty|ruling)\b/.test(text)) return "regulatory";
  if (/\b(visa|residency|policy|law|tax|reform)\b/.test(text)) return "policy";
  if (/\b(metro|airport|highway|infrastructure|bridge|tunnel)\b/.test(text)) return "infrastructure";
  if (/\b(earnings|results|acquisition|merger|ipo|leadership|ceo|cfo)\b/.test(text))
    return "developer-corporate";
  if (/\b(gdp|inflation|interest rate|central bank|economy|fdi)\b/.test(text)) return "macro";
  return "market-pulse";
}

/** Determine which markets the cluster covers */
function detectMarkets(entries: RawEntry[]): Cluster["suggestedMarkets"] {
  const text = entries.map((e) => `${e.title} ${e.summary}`).join(" ").toLowerCase();
  const markets: Cluster["suggestedMarkets"] = [];
  if (/\bdubai\b/.test(text)) markets.push("Dubai");
  if (/\babu dhabi\b/.test(text)) markets.push("Abu Dhabi");
  if (/\b(ras al khaimah|rak|al marjan|wynn)\b/.test(text)) markets.push("Ras Al Khaimah");
  if (markets.length === 0) markets.push("UAE");
  return markets;
}

/* ─── Scoring ────────────────────────────────────────────────────────── */

function scoreUhnwRelevance(entries: RawEntry[]): number {
  const text = entries.map((e) => `${e.title} ${e.summary}`).join(" ").toLowerCase();
  let hits = 0;
  for (const kw of UHNW_KEYWORDS) {
    if (text.includes(kw.toLowerCase())) hits++;
  }
  return Math.min(100, hits * 10);
}

function scoreSourceTier(entries: RawEntry[]): number {
  const maxWeight = Math.max(
    ...entries.map((e) => TIER_WEIGHT[e.source.tier])
  );
  return Math.round(maxWeight * 100);
}

function scoreFreshness(entries: RawEntry[]): number {
  const now = Date.now();
  const newest = Math.max(
    ...entries.map((e) => new Date(e.publishedAt).getTime())
  );
  const hoursAgo = (now - newest) / (1000 * 60 * 60);
  if (hoursAgo < 2) return 100;
  if (hoursAgo < 6) return 85;
  if (hoursAgo < 24) return 70;
  if (hoursAgo < 48) return 50;
  if (hoursAgo < 72) return 30;
  return 10;
}

function scoreRajAngle(entries: RawEntry[]): number {
  const text = entries.map((e) => `${e.title} ${e.summary}`).join(" ").toLowerCase();
  let hits = 0;
  for (const kw of RAJ_ANGLE_KEYWORDS) {
    if (text.includes(kw.toLowerCase())) hits++;
  }
  return Math.min(100, hits * 8);
}

/** Does the headline itself signal a real-estate story? Used by the relevance
 *  gate to keep the top slots for property news, not tangential macro pieces. */
const RE_TOPIC_TERMS = [
  "real estate", "real-estate", "property", "properties", "villa", "apartment",
  "penthouse", "townhouse", "mansion", "rent", "rental", "rents", "mortgage",
  "off-plan", "off plan", "freehold", "leasehold", "developer", "handover",
  "escrow", "oqood", "title deed", "branded residence", "branded residences",
  "waterfront", "beachfront", "master plan", "master-plan", "plot", "psf",
  "per sqft", "sq ft", "dld", "land department", "rera", "golden visa", "yield",
  "residences", "homebuyer", "home sales", "property market", "real estate market",
  "transactions worth", "sales value", "house price", "housing",
];
function topicIsRealEstate(topic: string): boolean {
  const t = topic.toLowerCase();
  return RE_TOPIC_TERMS.some((k) => t.includes(k));
}

/* ─── Main entrypoint ────────────────────────────────────────────────── */

/**
 * Cluster deduplicated entries by topic/entity, score each, return
 * top-N sorted by composite score (descending).
 *
 * @param entries  deduplicated raw entries (post-dedupe pass)
 * @param topN     cap on returned clusters (default 10 per master plan)
 */
export function clusterAndScore(
  entries: RawEntry[],
  topN = 10
): Cluster[] {
  // 1. Group by signature
  const groups = new Map<string, RawEntry[]>();
  const ungrouped: RawEntry[] = [];
  for (const e of entries) {
    const sig = signatureFor(e);
    if (sig === null) {
      ungrouped.push(e);
      continue;
    }
    if (!groups.has(sig)) groups.set(sig, []);
    groups.get(sig)!.push(e);
  }

  // 1b. Entries with no known-entity signature used to be dropped. Instead,
  // cluster them by headline similarity so a real story without a known
  // developer/place (e.g. a record rental, a new regulation) still surfaces —
  // and an off-topic lone item just becomes a low-scoring singleton that the
  // min-score filter removes (no more mega-bucket of unrelated news).
  const HEADLINE_SIM = 0.45;
  const simClusters: RawEntry[][] = [];
  for (const e of ungrouped) {
    let placed = false;
    for (const c of simClusters) {
      if (similarity(e.title, c[0].title) >= HEADLINE_SIM) {
        c.push(e);
        placed = true;
        break;
      }
    }
    if (!placed) simClusters.push([e]);
  }
  simClusters.forEach((c, i) => groups.set(`topic--${i}-${c[0].id}`, c));

  // 2. Build cluster objects
  const clusters: Cluster[] = [];
  for (const [sig, groupEntries] of groups.entries()) {
    const entities = extractEntities(groupEntries);
    const breakdown = {
      uhnwRelevance: scoreUhnwRelevance(groupEntries),
      sourceTier: scoreSourceTier(groupEntries),
      freshness: scoreFreshness(groupEntries),
      rajAngle: scoreRajAngle(groupEntries),
    };
    // Composite — weighted average (UHNW + Raj angle weighted highest), plus a
    // headline real-estate bonus so genuine property stories outrank tangential
    // macro/lifestyle pieces that ride press-tier + freshness.
    const reBonus = topicIsRealEstate(groupEntries[0].title) ? 15 : 0;
    const score = Math.min(
      100,
      Math.round(
        breakdown.uhnwRelevance * 0.30 +
          breakdown.sourceTier * 0.25 +
          breakdown.freshness * 0.20 +
          breakdown.rajAngle * 0.25,
      ) + reBonus,
    );

    clusters.push({
      id: sig,
      topic: groupEntries[0].title,
      entries: groupEntries.sort((a, b) => {
        const t = TIER_WEIGHT[b.source.tier] - TIER_WEIGHT[a.source.tier];
        if (t !== 0) return t;
        return b.publishedAt.localeCompare(a.publishedAt);
      }),
      score,
      scoreBreakdown: breakdown,
      entities,
      suggestedCategory: categorizeCluster(groupEntries),
      suggestedMarkets: detectMarkets(groupEntries),
    });
  }

  // 3. Relevance gate — the cluster's HEADLINE (not a stray keyword buried in
  // one of N entries) must signal real estate. Aggregator queries occasionally
  // surface tangential macro/lifestyle stories that clear the bar on press-tier
  // + freshness alone; this keeps the top slots for actual property stories.
  const relevant = clusters.filter(
    (c) =>
      c.entities.places.length > 0 ||
      c.entities.developers.length > 0 ||
      topicIsRealEstate(c.topic) ||
      c.scoreBreakdown.rajAngle >= 24, // ≥3 strong Raj-angle hits
  );

  // 4. Sort by score, take top-N
  relevant.sort((a, b) => b.score - a.score);
  return relevant.slice(0, topN);
}
