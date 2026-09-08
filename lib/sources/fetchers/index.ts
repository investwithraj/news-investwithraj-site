// Source-fetch orchestrator. Runs every configured discovery source in
// parallel and returns the FetchRun summary + aggregated entries.

import type { FetchRun, FetchResult } from "./types";
export type { RawEntry, FetchResult, FetchRun } from "./types";
import { FETCH_SOURCES } from "@/lib/sources/registry";
import { fetchRssFeed } from "./rss";
import { fetchWebPage } from "./webfetch";
import { fetchReddit } from "./reddit";

/** Run all fetch sources in parallel. Each source has its own timeout
 *  + graceful failure — a single source erroring never blocks the rest. */
export async function fetchAllSources(): Promise<FetchRun> {
  const startedAt = new Date().toISOString();
  const promises = FETCH_SOURCES.map((source) => {
    if (source.fetchType === "rss") return fetchRssFeed(source);
    if (source.fetchType === "reddit") return fetchReddit(source);
    return fetchWebPage(source);
  });

  const results: FetchResult[] = await Promise.all(promises);

  const totalEntries = results.reduce((sum, r) => sum + r.entries.length, 0);
  const okCount = results.filter((r) => r.error === null).length;
  const errorCount = results.length - okCount;
  const datedEntrySourceCount = results.filter(
    (result) => result.error === null && hasDatedEntry(result),
  ).length;
  const emptySourceCount = results.filter(
    (result) => result.error === null && !hasDatedEntry(result),
  ).length;

  return {
    startedAt,
    finishedAt: new Date(Date.now()).toISOString(),
    results,
    totalEntries,
    okCount,
    errorCount,
    transportOkCount: okCount,
    datedEntrySourceCount,
    emptySourceCount,
  };
}

/** Get a flat list of all entries across all successful sources. */
export function flattenEntries(run: FetchRun) {
  return run.results.flatMap((r) => r.entries);
}

function hasDatedEntry(result: FetchResult): boolean {
  return result.entries.some((entry) =>
    Number.isFinite(Date.parse(entry.publishedAt)),
  );
}

/** Log a structured pipeline summary for the schedule-skill run logs. */
export function summarizeFetchRun(run: FetchRun): string {
  const lines: string[] = [];
  const sourceCount = run.results.length;
  const transportResults = run.results.filter((result) => result.error === null);
  const datedResults = transportResults.filter(hasDatedEntry);
  const emptyResults = transportResults.filter((result) => !hasDatedEntry(result));
  const errorResults = run.results.filter((result) => result.error !== null);

  lines.push(
    `📰 Transport responses: ${transportResults.length}/${sourceCount} sources`,
  );
  lines.push(
    `🗓️ Dated-entry producers: ${datedResults.length}/${sourceCount} sources (${run.totalEntries} entries)`,
  );
  if (emptyResults.length > 0) {
    lines.push(
      `ℹ️  ${emptyResults.length} source(s) returned no dated entries after successful transport:`,
    );
    for (const result of emptyResults) {
      lines.push(`    - ${result.source.name}`);
    }
  }
  if (errorResults.length > 0) {
    lines.push(`⚠️  ${errorResults.length} source transport error(s):`);
    for (const r of errorResults) {
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
