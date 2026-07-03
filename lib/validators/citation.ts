// Citation gate — Block 15 validator #1.
// Every auto-drafted article must cite ≥1 source from the 20-source
// whitelist (lib/sources/registry.ts). Articles failing this gate are
// rejected; Claude is re-prompted with the failure reason.
//
// This validator is also reusable for human-edited articles in the
// /internal/dashboard editorial queue.

import { findSourceByUrl, SOURCE_WHITELIST, TIER_WEIGHT } from "@/lib/sources/registry";

export interface CitationInput {
  url: string;
  /** Optional display name — falls back to the resolved source name. */
  label?: string;
  /** ISO timestamp the article author accessed the source. */
  accessedAt?: string;
}

export interface CitationResult {
  pass: boolean;
  /** Reason for rejection (passed to Claude on retry). null if pass. */
  reason: string | null;
  /** Whitelist hits — which whitelisted sources got cited. */
  whitelistHits: Array<{
    sourceName: string;
    sourceTier: string;
    tierWeight: number;
    citationUrl: string;
  }>;
  /** Non-whitelist citations (allowed but don't count toward gate). */
  nonWhitelistCitations: CitationInput[];
  /** Highest tier-weight among whitelist hits — used by scorer. */
  topTierWeight: number;
}

/**
 * Validate a citation array against the whitelist. Returns pass=true only
 * when ≥1 entry resolves to a whitelisted source.
 *
 * Edge cases handled:
 *  - Empty citations array → fail
 *  - All non-whitelist citations → fail with helpful reason
 *  - Mixed whitelist + non-whitelist → pass (non-whitelist allowed alongside)
 *  - Malformed URLs → caught + reported
 */
export function validateCitations(citations: CitationInput[]): CitationResult {
  const result: CitationResult = {
    pass: false,
    reason: null,
    whitelistHits: [],
    nonWhitelistCitations: [],
    topTierWeight: 0,
  };

  if (!Array.isArray(citations) || citations.length === 0) {
    result.reason =
      "Article has zero citations. Add ≥1 citation from the whitelist: " +
      SOURCE_WHITELIST.slice(0, 5)
        .map((s) => s.name)
        .join(", ") +
      ", etc.";
    return result;
  }

  for (const c of citations) {
    if (!c.url || typeof c.url !== "string") {
      result.nonWhitelistCitations.push(c);
      continue;
    }
    const src = findSourceByUrl(c.url);
    if (src) {
      result.whitelistHits.push({
        sourceName: src.name,
        sourceTier: src.tier,
        tierWeight: TIER_WEIGHT[src.tier],
        citationUrl: c.url,
      });
      if (TIER_WEIGHT[src.tier] > result.topTierWeight) {
        result.topTierWeight = TIER_WEIGHT[src.tier];
      }
    } else {
      result.nonWhitelistCitations.push(c);
    }
  }

  if (result.whitelistHits.length === 0) {
    result.reason =
      "All citations are non-whitelisted. ≥1 citation must come from the verified-source whitelist: " +
      SOURCE_WHITELIST.slice(0, 5)
        .map((s) => `${s.name} (${new URL(s.url).hostname})`)
        .join(", ") +
      ", plus 15 more — see lib/sources/registry.ts.";
    return result;
  }

  result.pass = true;
  return result;
}

/** Convenience wrapper for the pipeline — just need true/false + reason. */
export function citationGate(citations: CitationInput[]): {
  pass: boolean;
  reason: string | null;
} {
  const r = validateCitations(citations);
  return { pass: r.pass, reason: r.reason };
}
