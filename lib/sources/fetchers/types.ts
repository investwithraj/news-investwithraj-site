// Shared types for the source-fetching layer.

import type { SourceTier, VerifiedSource } from "@/lib/sources/registry";

/** A single raw entry pulled from a verified source — pre-clustering. */
export interface RawEntry {
  /** Source-assigned unique ID (or URL-derived hash if absent) */
  id: string;
  /** Headline / title from the source */
  title: string;
  /** Canonical URL of the article on the source's site */
  url: string;
  /** Publication timestamp (ISO) */
  publishedAt: string;
  /** Short description / summary (often the article's first paragraph) */
  summary: string;
  /** Source metadata from lib/sources/registry */
  source: {
    name: string;
    tier: SourceTier;
    domain: string;
  };
  /** Raw markup snippet for context (typically the first 2-3 paragraphs)
   *  for the drafting step. Optional — populated only when full-text fetch
   *  succeeds, otherwise summary is used. */
  fullText?: string;
  /** Optional categories / tags from the source feed */
  categories?: string[];
  /** Optional hero image URL surfaced by the feed */
  heroImage?: string;
}

/** Result of a single source fetch — includes error info for graceful degradation. */
export interface FetchResult {
  source: VerifiedSource;
  entries: RawEntry[];
  /** Null on success, error message on failure (fetch continues with other sources) */
  error: string | null;
  /** ms elapsed for the fetch — useful for perf tracking */
  durationMs: number;
}

/** Aggregated multi-source fetch run */
export interface FetchRun {
  startedAt: string;
  finishedAt: string;
  results: FetchResult[];
  /** Total unique entries collected */
  totalEntries: number;
  /** How many sources errored vs succeeded */
  okCount: number;
  errorCount: number;
}
