// Clustering + scoring. Groups deduplicated entries by topic/entity and
// scores each cluster on UHNW relevance × source tier × freshness × Raj
// coverage angle, returning the top-N for drafting.

import type { RawEntry } from "@/lib/sources/fetchers";
import type { Cluster, ClusterEntities } from "./types";
import { TIER_WEIGHT } from "@/lib/sources/registry";
import { similarity } from "./dedupe";
import { createHash } from "node:crypto";

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

/** Match a maintained entity as a complete name/token. Plain substring
 * matching made short brands such as MAG appear inside unrelated words such
 * as "magazine", which could manufacture a developer signature and let an
 * off-desk story through the relevance gate. */
function hasKnownEntity(text: string, entity: string): boolean {
  const escapedEntity = entity
    .trim()
    .split(/\s+/u)
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("\\s+");
  return new RegExp(
    `(?:^|[^\\p{L}\\p{N}])${escapedEntity}(?=$|[^\\p{L}\\p{N}])`,
    "iu",
  ).test(text);
}

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
  "ADGM",
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

// An article's publisher/feed geography is not the story's geography. A UAE
// outlet can cover a New Zealand visa or a Goa villa, and UAE developers also
// build abroad. Require a local link in each entry BEFORE grouping or scoring.
const UAE_LOCATION_NAMES = [
  ...GENERIC_PLACES,
  "United Arab Emirates",
  "U.A.E.",
  "Fujairah",
  "Umm Al Quwain",
  "Al Ain",
  "Emirati",
];
const UAE_INSTITUTIONS = ["DLD", "CBUAE", "Oqood", "Ejari"];

// These maintained community names also have ordinary meanings overseas.
// Without an explicit UAE place, require their developer as corroboration.
const AMBIGUOUS_COMMUNITY_DEVELOPERS: Record<string, string[]> = {
  "The Valley": ["Emaar"],
  "The Oasis": ["Emaar"],
  "City Walk": ["Meraas"],
  "District One": ["Meydan", "Nakheel"],
  "Town Square": ["Nshama"],
};

function entryHasUaeLink(entry: RawEntry): boolean {
  let text = `${entry.title}\n${entry.summary}`;

  // Being headquartered in Dubai does not make a foreign-only project local.
  // Remove only these company-origin phrases, retaining any separate UAE
  // project, market or investor connection elsewhere in the title/summary.
  for (const location of UAE_LOCATION_NAMES) {
    const name = location.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    text = text
      .replace(
        new RegExp(`\\b${name}[-\\s]+(?:based|headquartered|registered|incorporated)\\b`, "gi"),
        " ",
      )
      .replace(
        new RegExp(`\\b(?:based|headquartered|registered|incorporated)\\s+in\\s+(?:the\\s+)?${name}(?=$|[^\\p{L}\\p{N}])`, "giu"),
        " ",
      );
  }

  if (UAE_LOCATION_NAMES.some((name) => hasKnownEntity(text, name))) return true;
  // RERA is intentionally absent: the same acronym is used by Indian
  // regulators. A UAE-developer name alone is likewise not geographic proof.
  if (UAE_INSTITUTIONS.some((name) => hasKnownEntity(text, name))) return true;
  return KNOWN_PLACES.some((place) => {
    if (!hasKnownEntity(text, place)) return false;
    const developers = AMBIGUOUS_COMMUNITY_DEVELOPERS[place];
    return !developers || developers.some((name) => hasKnownEntity(text, name));
  });
}

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

  const developers = KNOWN_DEVELOPERS.filter((developer) =>
    hasKnownEntity(text, developer)
  );
  const places = KNOWN_PLACES.filter((place) => hasKnownEntity(text, place));

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
    if (hasKnownEntity(text, place)) {
      for (const dev of KNOWN_DEVELOPERS) {
        if (hasKnownEntity(text, dev)) {
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
    if (hasKnownEntity(text, dev)) {
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
  if (/\b(ras al khaimah|rak|al marjan)\b/.test(text)) markets.push("Ras Al Khaimah");
  // All entries have passed entryHasUaeLink; this is a broad local label,
  // never a fallback that establishes relevance for an unlocated story.
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
  const publisherDomains = new Set(
    entries.map((entry) => entry.source.domain.replace(/^www\./, "")),
  ).size;
  return Math.min(
    100,
    Math.round(maxWeight * 70 + Math.min(30, (publisherDomains - 1) * 15)),
  );
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
  "residential project", "residential development", "construction contract",
];
function topicIsRealEstate(topic: string): boolean {
  const t = topic.toLowerCase();
  return RE_TOPIC_TERMS.some((k) => t.includes(k));
}

const EDITORIAL_EXCLUSION_RE =
  /\b(celebrity|fortune|net worth|private[- ]jet|home tour|lifestyle of|inside (?:his|her|their) (?:home|estate|penthouse))\b/i;

function topicFitsPropertyDesk(topic: string): boolean {
  return topicIsRealEstate(topic) && !EDITORIAL_EXCLUSION_RE.test(topic);
}

/** Stable, reservation-safe ID for headline-similarity clusters. Feed GUIDs
 * can contain URL/base64 characters that the server automation contract
 * deliberately rejects. Hash the source identity instead of weakening that
 * boundary or truncating a shared GUID prefix. */
export function topicClusterId(entry: Pick<RawEntry, "id" | "title">): string {
  const digest = createHash("sha256")
    .update(`${entry.id}\n${entry.title}`, "utf8")
    .digest("hex")
    .slice(0, 32);
  return `topic:${digest}`;
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
  // 1. Reject entries without their own UAE link before grouping. Otherwise a
  // foreign item could borrow relevance from a local entry in the same broad
  // policy/developer bucket, become its topic and consume a research attempt.
  const groups = new Map<string, RawEntry[]>();
  const ungrouped: RawEntry[] = [];
  for (const e of entries) {
    if (!entryHasUaeLink(e)) continue;
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
  simClusters.forEach((cluster) =>
    groups.set(topicClusterId(cluster[0]), cluster),
  );

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
    const reBonus = groupEntries.some((entry) =>
      topicFitsPropertyDesk(entry.title)
    )
      ? 15
      : 0;
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
      !EDITORIAL_EXCLUSION_RE.test(c.topic) &&
      (c.entities.places.length > 0 ||
        c.entities.developers.length > 0 ||
        topicFitsPropertyDesk(c.topic) ||
        c.scoreBreakdown.rajAngle >= 24), // ≥3 strong Raj-angle hits
  );

  // 4. Sort by score, take top-N
  relevant.sort((a, b) => b.score - a.score);
  return relevant.slice(0, topN);
}
