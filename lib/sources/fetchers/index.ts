// Source-fetch orchestrator. Runs all 20 verified sources in parallel,
// returns FetchRun summary + aggregated entries.

import type { FetchRun, FetchResult } from "./types";
export type { RawEntry, FetchResult, FetchRun } from "./types";
import { FETCH_SOURCES } from "@/lib/sources/registry";
import { fetchRssFeed } from "./rss";
import { fetchWebPage } from "./webfetch";

/** Run all fetch sources in parallel. Each source has its own timeout
 *  + graceful failure — a single source erroring never blocks the rest. */
export async function fetchAllSources(): Promise<FetchRun> {
  const startedAt = new Date().toISOString();
  const startMs = performance.now();

  const promises = FETCH_SOURCES.map((source) => {
    if (source.fetchType === "rss") {
      return fetchRssFeed(source);
    }
    return fetchWebPage(source);
  });

  const results: FetchResult[] = await Promise.all(promises);

  const totalEntries = results.reduce((sum, r) => sum + r.entries.length, 0);
  const okCount = results.filter((r) => r.error === null).length;
  const errorCount = results.length - okCount;

  return {
    startedAt,
    finishedAt: new Date(Date.now()).toISOString(),
    results,
    totalEntries,
    okCount,
    errorCount,
  };
}

/** Get a flat list of all entries across all successful sources. */
export function flattenEntries(run: FetchRun) {
  return run.results.flatMap((r) => r.entries);
}

/** Log a structured pipeline summary for the schedule-skill run logs. */
export function summarizeFetchRun(run: FetchRun): string {
  const lines: string[] = [];
  lines.push(`📰 Fetched ${run.totalEntries} entries from ${run.okCount}/${FETCH_SOURCES.length} sources`);
  if (run.errorCount > 0) {
    lines.push(`⚠️  ${run.errorCount} source(s) errored:`);
    for (const r of run.results.filter((r) => r.error)) {
      lines.push(`    - ${r.source.name}: ${r.error}`);
    }
  }
  // Per-tier breakdown
  const byTier: Record<string, number> = {};
  for (const r of run.results) {
    byTier[r.source.tier] = (byTier[r.source.tier] || 0) + r.entries.length;
  }
  lines.push(`📊 By tier: ${Object.entries(byTier).map(([t, n]) => `${t}=${n}`).join(" · ")}`);
  return lines.join("\n");
}
