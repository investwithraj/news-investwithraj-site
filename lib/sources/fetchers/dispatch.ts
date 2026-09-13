import type { SourceFetchFailure } from "@/lib/sources/safe-fetch";

const GLOBAL_FETCH_LIMIT = 4;

function stopsHost(failure: SourceFetchFailure | undefined): boolean {
  return Boolean(failure && (
    (failure.code === "http" && [403, 429, 503].includes(failure.status ?? 0)) ||
    (failure.code === "content-type" && ["text/html", "application/xhtml+xml"].includes(failure.contentType ?? ""))
  ));
}

export function providerBackoffMessage(failure: SourceFetchFailure): string {
  const reason = failure.status === 200 ? failure.contentType : failure.status;
  return `Skipped without a request: provider backoff for ${failure.host}${reason ? ` (${reason})` : ""}; no retry this run.`;
}

/** One active source per target host, at most four hosts in parallel. A host
 * refusal/outage ends that host's queue for this run; no retries, probes, waits,
 * identity changes or process-global state. Output stays in registry order. */
export async function dispatchSourceFetches<Item, Result extends { failure?: SourceFetchFailure }>(
  items: readonly Item[],
  target: (item: Item) => string,
  fetchItem: (item: Item) => Promise<Result>,
  skipped: (item: Item, failure: SourceFetchFailure) => Result,
): Promise<Result[]> {
  const groups = new Map<string, { item: Item; index: number }[]>();
  items.forEach((item, index) => {
    let host: string;
    try { host = new URL(target(item)).hostname.toLowerCase().replace(/\.$/u, ""); }
    catch { host = `invalid-source-${index}`; } // The source fetcher reports its normal validation failure.
    const group = groups.get(host) ?? [];
    group.push({ item, index });
    groups.set(host, group);
  });
  const queues = [...groups.values()];
  const results: Result[] = new Array(items.length);
  let nextGroup = 0;
  const worker = async () => {
    while (nextGroup < queues.length) {
      const queue = queues[nextGroup++];
      let stopped: SourceFetchFailure | undefined;
      for (const { item, index } of queue) {
        if (stopped) {
          results[index] = skipped(item, { ...stopped, code: "provider-backoff" });
          continue;
        }
        const result = await fetchItem(item);
        results[index] = result;
        if (stopsHost(result.failure)) stopped = result.failure;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(GLOBAL_FETCH_LIMIT, queues.length) }, worker));
  return results;
}
