// IndexNow protocol client for the two canonical Invest With Raj hosts.
// IndexNow keys are deliberately public verification values. Mutation access
// remains protected by the server secret, production-host guard, feature flag
// and durable receipt ledger in the route layer.

const INDEXNOW_ENDPOINT = "https://api.indexnow.org/IndexNow";

export const INDEXNOW_KEY = "0d6e3835646ccbe5dba5ed6ab2646308";
export const INDEXNOW_MAIN_KEY = "fa54a88f6758df8bd6eab00d61896015";

const INDEXNOW_HOST_PROFILES = {
  "news.investwithraj.com": {
    key: INDEXNOW_KEY,
    keyLocation: `https://news.investwithraj.com/${INDEXNOW_KEY}.txt`,
  },
  "investwithraj.com": {
    key: INDEXNOW_MAIN_KEY,
    keyLocation: `https://investwithraj.com/${INDEXNOW_MAIN_KEY}.txt`,
  },
} as const;

export const INDEXNOW_ALLOWED_HOSTS = Object.freeze(
  Object.keys(INDEXNOW_HOST_PROFILES),
) as readonly (keyof typeof INDEXNOW_HOST_PROFILES)[];

type IndexNowHost = (typeof INDEXNOW_ALLOWED_HOSTS)[number];

export interface IndexNowProviderReceipt {
  host: IndexNowHost;
  configured: true;
  attempted: boolean;
  accepted: boolean;
  statusCode: number | null;
  submittedUrls: number;
  message: string;
}

export interface IndexNowResult {
  ok: boolean;
  statusCode: number;
  message: string;
  submittedUrls: number;
  receipts: IndexNowProviderReceipt[];
}

export type NormalizedIndexNowUrls = Readonly<{
  urls: string[];
  rejectedCount: number;
}>;

/** Accept exact canonical HTTPS hosts only; credentials, fragments and query
 * tracking are stripped before the provider sees a URL. */
export function normalizeIndexNowUrls(
  values: unknown[],
  max = 1_000,
): NormalizedIndexNowUrls {
  const output = new Set<string>();
  let rejectedCount = 0;

  for (const value of values.slice(0, max)) {
    if (typeof value !== "string" || value.length > 2_048) {
      rejectedCount += 1;
      continue;
    }
    try {
      const url = new URL(value);
      if (
        url.protocol !== "https:" ||
        !INDEXNOW_ALLOWED_HOSTS.includes(url.hostname as IndexNowHost) ||
        url.port ||
        url.username ||
        url.password
      ) {
        rejectedCount += 1;
        continue;
      }
      url.hash = "";
      url.search = "";
      output.add(url.toString());
    } catch {
      rejectedCount += 1;
    }
  }

  if (values.length > max) rejectedCount += values.length - max;
  return {
    urls: [...output].sort((left, right) => left.localeCompare(right, "en")),
    rejectedCount,
  };
}

/** Submit one provider request per host, as required by the IndexNow protocol. */
export async function submitToIndexNow(urls: string[]): Promise<IndexNowResult> {
  if (urls.length === 0) {
    return {
      ok: true,
      statusCode: 200,
      message: "No URLs to submit",
      submittedUrls: 0,
      receipts: [],
    };
  }
  if (urls.length > 10_000) {
    return {
      ok: false,
      statusCode: 400,
      message: "IndexNow allows a maximum of 10,000 URLs per operation",
      submittedUrls: 0,
      receipts: [],
    };
  }

  const normalized = normalizeIndexNowUrls(urls, 10_000);
  if (normalized.rejectedCount > 0 || normalized.urls.length !== urls.length) {
    return {
      ok: false,
      statusCode: 400,
      message: "The request contains a URL outside the canonical host allowlist",
      submittedUrls: 0,
      receipts: [],
    };
  }

  const groups = new Map<IndexNowHost, string[]>();
  for (const value of normalized.urls) {
    const host = new URL(value).hostname as IndexNowHost;
    const group = groups.get(host) ?? [];
    group.push(value);
    groups.set(host, group);
  }

  const receipts: IndexNowProviderReceipt[] = [];
  for (const host of INDEXNOW_ALLOWED_HOSTS) {
    const hostUrls = groups.get(host);
    if (!hostUrls?.length) continue;
    const profile = INDEXNOW_HOST_PROFILES[host];
    try {
      const response = await fetch(INDEXNOW_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          Accept: "application/json",
        },
        body: JSON.stringify({
          host,
          key: profile.key,
          keyLocation: profile.keyLocation,
          urlList: hostUrls,
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(8_000),
      });
      const accepted = response.ok || response.status === 202;
      receipts.push({
        host,
        configured: true,
        attempted: true,
        accepted,
        statusCode: response.status,
        submittedUrls: hostUrls.length,
        message: accepted
          ? response.status === 202
            ? "Accepted for processing"
            : "Accepted"
          : `Provider rejected the host batch with HTTP ${response.status}`,
      });
    } catch {
      receipts.push({
        host,
        configured: true,
        attempted: true,
        accepted: false,
        statusCode: null,
        submittedUrls: hostUrls.length,
        message: "Provider outcome could not be confirmed",
      });
    }
  }

  const ok = receipts.length > 0 && receipts.every((receipt) => receipt.accepted);
  return {
    ok,
    statusCode: ok ? 200 : 502,
    message: ok
      ? `IndexNow accepted ${normalized.urls.length} canonical URL(s) across ${receipts.length} host batch(es)`
      : "One or more IndexNow host batches were not accepted",
    submittedUrls: receipts
      .filter((receipt) => receipt.accepted)
      .reduce((total, receipt) => total + receipt.submittedUrls, 0),
    receipts,
  };
}
