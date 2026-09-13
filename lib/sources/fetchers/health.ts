import type { VerifiedSource } from "@/lib/sources/registry";
import {
  safeFetchBytes,
  sourceFetchFailure,
  urlOnApprovedHost,
  type SafeFetchOptions,
  type SafeFetchResult,
  type SourceFetchFailure,
} from "@/lib/sources/safe-fetch";
import { parseRssDocument } from "@/lib/sources/fetchers/rss";
import { extractCandidateLinks } from "@/lib/sources/fetchers/webfetch";
import { dispatchSourceFetches, providerBackoffMessage } from "./dispatch";

export type SourceDiscoveryState =
  | "dated-entries"
  | "transport-only"
  | "provider-backoff"
  | "review";

export interface SourceHealthResult {
  name: string;
  target: string;
  /** Backwards-compatible availability flag. Consult discoveryOk/state when
   * deciding whether a source can currently discover dated material. */
  ok: boolean;
  transportOk: boolean;
  discoveryOk: boolean;
  discoveryState: SourceDiscoveryState;
  status: number;
  latencyMs: number;
  entryCount?: number;
  newestPublishedAt?: string;
  error?: string;
  failure?: SourceFetchFailure;
}

type HealthBytesFetch = (
  initialUrl: string,
  options: SafeFetchOptions,
) => Promise<SafeFetchResult>;

export interface SourceHealthOptions {
  /** Deterministic test seam. Production defaults to the DNS-pinned,
   * allowlisted safe fetcher rather than unrestricted global fetch. */
  fetchBytesImpl?: HealthBytesFetch;
  timeoutMs?: number;
  clock?: () => number;
}

/** Check first-party source availability within the same network boundaries as
 * ingestion. A transport response is reported separately from discovery: only
 * bounded candidates with explicit publisher dates count as discovery health. */
export async function checkOfficialSourceHealth(
  sources: VerifiedSource[],
  options: SourceHealthOptions = {},
): Promise<SourceHealthResult[]> {
  const fetchBytesImpl = options.fetchBytesImpl ?? safeFetchBytes;
  const timeoutMs = options.timeoutMs ?? 8_000;
  const clock = options.clock ?? Date.now;

  return dispatchSourceFetches<VerifiedSource, SourceHealthResult>(
    sources,
    (source) => source.rssUrl ?? source.fetchUrl ?? source.url,
    async (source) => {
      const started = clock();
      const target = source.rssUrl ?? source.fetchUrl ?? source.url;
      try {
        const sourceHost = new URL(source.url).hostname;
        const targetHost = new URL(target).hostname;
        const allowedDomains = [...new Set([sourceHost, targetHost])];
        const isRss = source.fetchType === "rss";
        const response = await fetchBytesImpl(target, {
          allowedDomains,
          accept: isRss
            ? "application/rss+xml, application/atom+xml, application/xml, text/xml"
            : "text/html,application/xhtml+xml",
          allowedContentTypes: isRss
            ? /(?:application\/(?:rss\+xml|atom\+xml|xml)|text\/xml)/i
            : /(?:text\/html|application\/xhtml\+xml)/i,
          maxBytes: 2 * 1024 * 1024,
          timeoutMs,
          maxRedirects: 3,
          userAgent:
            "InvestWithRaj source-health/1.0 (+https://news.investwithraj.com/about/editorial-standards)",
        });
        // Defence in depth for the injected test seam: even a fetch
        // implementation that returns an off-host final URL cannot make the
        // health report trust a publisher-controlled redirect.
        if (!urlOnApprovedHost(response.finalUrl, allowedDomains)) {
          throw new Error(
            "Source health redirect resolved outside the approved HTTPS host boundary.",
          );
        }
        const base = {
          name: source.name,
          target,
          status: 200,
          latencyMs: Math.max(0, clock() - started),
          transportOk: true,
        };

        const document = response.bytes.toString("utf8");
        const entries = isRss
          ? parseRssDocument(document, source)
          : extractCandidateLinks(
              document,
              target,
              source.name,
              source.tier,
              sourceHost.replace(/^www\./, ""),
              5,
            );
        if (entries.length === 0) {
          if (!isRss) {
            return {
              ...base,
              ok: true,
              discoveryOk: false,
              discoveryState: "transport-only" as const,
              entryCount: 0,
              error:
                "Transport responded, but the bounded index parser found no explicitly dated candidates.",
            };
          }
          return {
            ...base,
            ok: false,
            discoveryOk: false,
            discoveryState: "review" as const,
            entryCount: 0,
            error: "Feed has no publisher-hosted entries with an explicit publication date.",
          };
        }
        const newestPublishedAt = entries
          .map((entry) => entry.publishedAt)
          .sort((left, right) => right.localeCompare(left))[0];
        return {
          ...base,
          ok: true,
          discoveryOk: true,
          discoveryState: "dated-entries" as const,
          entryCount: entries.length,
          newestPublishedAt,
        };
      } catch (error) {
        return {
          name: source.name,
          target,
          ok: false,
          transportOk: false,
          discoveryOk: false,
          discoveryState: "review" as const,
          status: statusFromError(error),
          latencyMs: Math.max(0, clock() - started),
          error: error instanceof Error ? error.message : String(error),
          failure: sourceFetchFailure(error),
        };
      }
    },
    (source, failure) => ({
      name: source.name, target: source.rssUrl ?? source.fetchUrl ?? source.url,
      ok: false, transportOk: false, discoveryOk: false, discoveryState: "provider-backoff",
      status: 0, latencyMs: 0, entryCount: 0, error: providerBackoffMessage(failure), failure,
    }),
  );
}

function statusFromError(error: unknown): number {
  const failure = sourceFetchFailure(error);
  if (failure?.status !== undefined) return failure.status;
  const message = error instanceof Error ? error.message : String(error);
  const match = message.match(/Source request failed \((\d{3})\)\./u);
  return match ? Number(match[1]) : 0;
}
