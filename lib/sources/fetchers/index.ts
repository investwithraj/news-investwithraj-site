// Source-fetch orchestrator. Bounds per-host load and returns the FetchRun
// summary + aggregated entries, including queries skipped during host backoff.

import type { FetchRun, FetchResult } from "./types";
export type { RawEntry, FetchResult, FetchRun } from "./types";
import { FETCH_SOURCES } from "@/lib/sources/registry";
import { fetchRssFeed } from "./rss";
import { fetchWebPage } from "./webfetch";
import { fetchReddit } from "./reddit";
import type { VerifiedSource } from "@/lib/sources/registry";
import { dispatchSourceFetches, providerBackoffMessage } from "./dispatch";

/** Optional offline test seams; production uses registry sources and fetchers. */
export interface FetchAllSourcesOptions {
  sources?: readonly VerifiedSource[];
  fetchSource?: (source: VerifiedSource) => Promise<FetchResult>;
}

/** Independent hosts continue after failures; a refused/unavailable host is
 * not queried again in this run. Existing source validation stays unchanged. */
export async function fetchAllSources(options: FetchAllSourcesOptions = {}): Promise<FetchRun> {
  const startedAt = new Date().toISOString();
  const fetchSource = options.fetchSource ?? ((source: VerifiedSource) => {
    if (source.fetchType === "rss") return fetchRssFeed(source);
    if (source.fetchType === "reddit") return fetchReddit(source);
    return fetchWebPage(source);
  });
  const results = await dispatchSourceFetches(
    options.sources ?? FETCH_SOURCES,
    (source) => source.rssUrl ?? source.fetchUrl ?? source.url,
    fetchSource,
    (source, failure) => ({ source, entries: [], error: providerBackoffMessage(failure), failure, durationMs: 0 }),
  );

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
    skippedSourceCount: results.filter((result) => result.failure?.code === "provider-backoff").length,
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
  const skippedResults = run.results.filter((result) => result.failure?.code === "provider-backoff");
  const errorResults = run.results.filter((result) => result.error !== null && result.failure?.code !== "provider-backoff");

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
  if (skippedResults.length > 0) {
    lines.push(`⏸️  ${skippedResults.length} source(s) skipped without a request during provider backoff:`);
    for (const result of skippedResults) lines.push(`    - ${result.source.name}: ${result.error}`);
  }
  // Per-tier breakdown
  const byTier: Record<string, number> = {};
  for (const r of run.results) {
    byTier[r.source.tier] = (byTier[r.source.tier] || 0) + r.entries.length;
  }
  lines.push(`📊 By tier: ${Object.entries(byTier).map(([t, n]) => `${t}=${n}`).join(" · ")}`);
  return lines.join("\n");
}
