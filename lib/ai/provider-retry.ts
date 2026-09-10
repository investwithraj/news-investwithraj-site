/** Retries only explicit transient provider responses, never publication writes. */
const TRANSIENT_STATUS = new Set([429, 500, 502, 503, 504, 529]);
const MAX_ATTEMPTS = 3;
const MAX_RETRY_DELAY_MS = 15_000;

export async function fetchProviderWithRetry(
  url: string,
  init: RequestInit,
  dependencies: {
    fetcher?: typeof fetch;
    sleep?: (milliseconds: number) => Promise<void>;
    now?: () => number;
  } = {},
): Promise<Response> {
  const fetcher = dependencies.fetcher ?? fetch;
  const sleep = dependencies.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const now = dependencies.now ?? Date.now;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    // Network exceptions are ambiguous: do not repeat a possibly accepted paid
    // request. Only an explicit transient HTTP response authorizes a retry.
    const response = await fetcher(url, init);
    if (!TRANSIENT_STATUS.has(response.status) || attempt === MAX_ATTEMPTS - 1) {
      return response;
    }
    const retryAfter = response.headers.get("retry-after");
    let delay = 1_000 * 2 ** attempt;
    if (retryAfter !== null) {
      const seconds = /^\d+(?:\.\d+)?$/u.test(retryAfter.trim()) ? Number(retryAfter) : NaN;
      const requested = Number.isFinite(seconds)
        ? seconds * 1_000
        : Date.parse(retryAfter) - now();
      if (Number.isFinite(requested)) delay = Math.max(delay, requested);
    }
    // Do not ignore a provider's longer back-off or hold a serverless request
    // indefinitely. Return the error and let the scheduled recovery run retry.
    if (delay > MAX_RETRY_DELAY_MS || init.signal?.aborted) return response;
    await response.body?.cancel();
    await sleep(delay);
    init.signal?.throwIfAborted();
  }
  throw new Error("Provider retry budget exhausted");
}
