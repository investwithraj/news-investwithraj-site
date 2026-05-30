// De-duplication pass — remove duplicate entries based on URL exact match
// + headline similarity. Two articles about the same event from different
// sources are NOT deduplicated here (clustering handles that) — we only
// drop literal duplicates that would skew cluster scores.

import type { RawEntry } from "@/lib/sources/fetchers";

/** Strip a URL down to its canonical comparable form */
function canonicalUrl(url: string): string {
  try {
    const u = new URL(url);
    // Drop tracking params + fragment + trailing slash + www
    u.hash = "";
    for (const p of Array.from(u.searchParams.keys())) {
      if (p.startsWith("utm_") || p === "ref" || p === "source") {
        u.searchParams.delete(p);
      }
    }
    let s = u.toString();
    s = s.replace(/^https?:\/\/www\./, "https://");
    s = s.replace(/\/$/, "");
    return s.toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

/** Normalize a title for similarity comparison */
export function normalizeTitle(t: string): string {
  return t
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Jaccard similarity over word sets — fast + good enough for headlines */
export function similarity(a: string, b: string): number {
  const sa = new Set(normalizeTitle(a).split(" ").filter((w) => w.length > 2));
  const sb = new Set(normalizeTitle(b).split(" ").filter((w) => w.length > 2));
  if (sa.size === 0 || sb.size === 0) return 0;
  const intersection = [...sa].filter((w) => sb.has(w)).length;
  const union = new Set([...sa, ...sb]).size;
  return intersection / union;
}

/**
 * Dedupe a list of raw entries.
 *   - Drop entries with identical canonical URLs (keeping the highest-tier source's copy)
 *   - Drop entries with > similarityThreshold (default 0.85) headline match
 *     to a higher-tier entry (we'd rather keep DLD's version than Bayut's)
 */
export function dedupeEntries(
  entries: RawEntry[],
  similarityThreshold = 0.85
): RawEntry[] {
  const tierRank: Record<RawEntry["source"]["tier"], number> = {
    government: 5,
    "national-press": 4,
    "institutional-research": 3,
    "regional-press": 2,
    "industry-portal": 1,
  };

  // Stable sort: higher tier first, then most recent
  const sorted = [...entries].sort((a, b) => {
    const tierDiff = tierRank[b.source.tier] - tierRank[a.source.tier];
    if (tierDiff !== 0) return tierDiff;
    return b.publishedAt.localeCompare(a.publishedAt);
  });

  const kept: RawEntry[] = [];
  const seenUrls = new Set<string>();

  for (const entry of sorted) {
    const canon = canonicalUrl(entry.url);

    // URL-level dedupe
    if (seenUrls.has(canon)) continue;

    // Headline-level dedupe — check against already-kept entries
    let isDupe = false;
    for (const k of kept) {
      if (similarity(entry.title, k.title) >= similarityThreshold) {
        isDupe = true;
        break;
      }
    }
    if (isDupe) continue;

    kept.push(entry);
    seenUrls.add(canon);
  }

  return kept;
}
