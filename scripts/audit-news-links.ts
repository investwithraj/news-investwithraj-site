/**
 * Crawl every public page in sitemap.xml, then validate each unique internal
 * anchor destination. The three vertical replacement edges and the global
 * contact-email accessibility contract are explicit regressions.
 *
 * Usage:
 *   npx tsx scripts/audit-news-links.ts http://127.0.0.1:3130
 *   NEWS_LINK_AUDIT_BASE_URL=https://preview.example npx tsx scripts/audit-news-links.ts
 */

const CONTACT_EMAIL = "office@investwithraj.com";
const CANONICAL_HOST = "news.investwithraj.com";
const CONCURRENCY = 8;
const REQUEST_TIMEOUT_MS = 20_000;

const VERTICAL_REPLACEMENTS = [
  {
    source: "/v/dld-pulse",
    stale: "/news/2026-05-26-dld-21b-week",
    replacement:
      "/news/2026-07-25-dubai-logs-aed-419-94bn-in-h1-transactions-as-weekly-volumes",
  },
  {
    source: "/v/beyond-the-deal",
    stale: "/news/2026-05-26-golden-visa-mortgage-flex",
    replacement:
      "/news/2026-07-01-uk-buyers-lead-dubai-property-demand-but-banks-tighten-the-g",
  },
  {
    source: "/v/off-plan-watch",
    stale: "/news/2026-05-26-modon-hudayriyat-golf-estate",
    replacement:
      "/news/2026-07-09-modon-and-adib-launch-75-off-plan-financing-for-abu-dhabi-co",
  },
] as const;

interface FetchResult {
  body: string;
  contentType: string;
  error?: string;
  finalUrl: string;
  location?: string;
  status: number;
  url: string;
}

interface LinkEdge {
  destination: string;
  source: string;
}

function auditBaseUrl(): URL {
  const raw =
    process.argv[2] ??
    process.env.NEWS_LINK_AUDIT_BASE_URL ??
    "http://127.0.0.1:3130";
  const base = new URL(raw);
  base.hash = "";
  base.pathname = "/";
  base.search = "";
  return base;
}

function decodeMarkup(value: string): string {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;|&#x0*27;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function attribute(tag: string, name: string): string | null {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = tag.match(
    new RegExp(
      `\\s${escaped}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`,
      "i",
    ),
  );
  const value = match?.[1] ?? match?.[2] ?? match?.[3];
  return value === undefined ? null : decodeMarkup(value);
}

function anchorTags(html: string): string[] {
  return html.match(/<a\b[^>]*>/gi) ?? [];
}

function localUrl(target: URL, base: URL): URL {
  const local = new URL(`${target.pathname}${target.search}`, base);
  local.hash = "";
  return local;
}

function isNewsInternalUrl(url: URL, base: URL): boolean {
  return url.hostname === base.hostname || url.hostname === CANONICAL_HOST;
}

function normalizePath(url: URL): string {
  return `${url.pathname}${url.search}`;
}

async function fetchUrl(url: string): Promise<FetchResult> {
  try {
    const response = await fetch(url, {
      headers: {
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "user-agent": "iwr-news-link-audit/1.0",
      },
      // Keep redirect responses visible. Cross-domain canonical redirects
      // (for example /legal/privacy -> investwithraj.com) are valid internal
      // edges, but following them would expand this news-only crawl.
      redirect: "manual",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    return {
      body: await response.text(),
      contentType: response.headers.get("content-type") ?? "",
      finalUrl: response.url,
      location: response.headers.get("location") ?? undefined,
      status: response.status,
      url,
    };
  } catch (error) {
    return {
      body: "",
      contentType: "",
      error: error instanceof Error ? error.message : String(error),
      finalUrl: url,
      status: 0,
      url,
    };
  }
}

async function mapConcurrent<T, R>(
  items: readonly T[],
  limit: number,
  task: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;

  async function worker(): Promise<void> {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await task(items[index]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker()),
  );
  return results;
}

function sitemapPageUrls(xml: string, base: URL): string[] {
  const urls = new Set<string>();
  for (const match of xml.matchAll(/<loc>([\s\S]*?)<\/loc>/gi)) {
    const canonical = new URL(decodeMarkup(match[1].trim()));
    urls.add(localUrl(canonical, base).toString());
  }
  return [...urls];
}

function internalDestination(
  rawHref: string,
  sourceUrl: string,
  base: URL,
): string | null {
  const href = rawHref.trim();
  if (
    href === "" ||
    href.startsWith("#") ||
    /^(?:mailto|tel|sms|javascript|data):/i.test(href)
  ) {
    return null;
  }

  let resolved: URL;
  try {
    resolved = new URL(href, sourceUrl);
  } catch {
    return null;
  }
  if (!isNewsInternalUrl(resolved, base)) return null;
  return localUrl(resolved, base).toString();
}

function describeFailure(result: FetchResult): string {
  if (result.error) return result.error;
  const redirect = result.location ? ` (location: ${result.location})` : "";
  return `HTTP ${result.status}${redirect}`;
}

function isValidDestination(result: FetchResult): boolean {
  if (result.status >= 200 && result.status < 300) return true;
  return (
    result.status >= 300 &&
    result.status < 400 &&
    typeof result.location === "string" &&
    result.location.length > 0
  );
}

async function main(): Promise<void> {
  const base = auditBaseUrl();
  const failures: string[] = [];
  const sitemapUrl = new URL("/sitemap.xml", base).toString();
  const sitemap = await fetchUrl(sitemapUrl);

  if (sitemap.status < 200 || sitemap.status >= 300) {
    throw new Error(`Could not load ${sitemapUrl}: ${describeFailure(sitemap)}`);
  }

  const pageUrls = sitemapPageUrls(sitemap.body, base);
  if (pageUrls.length === 0) {
    throw new Error(`${sitemapUrl} contained no <loc> entries`);
  }

  const pageResults = await mapConcurrent(pageUrls, CONCURRENCY, fetchUrl);
  const fetchedByUrl = new Map(pageResults.map((result) => [result.url, result]));
  const edges = new Map<string, LinkEdge>();
  let anchorOccurrences = 0;
  let contactMailtoOccurrences = 0;

  for (const page of pageResults) {
    if (page.status < 200 || page.status >= 300) {
      failures.push(
        `Sitemap page ${normalizePath(new URL(page.url))}: ${describeFailure(page)}`,
      );
      continue;
    }
    if (!page.contentType.toLowerCase().includes("text/html")) {
      failures.push(
        `Sitemap page ${normalizePath(new URL(page.url))}: expected HTML, got ${page.contentType || "no content-type"}`,
      );
      continue;
    }

    for (const tag of anchorTags(page.body)) {
      anchorOccurrences += 1;
      const href = attribute(tag, "href");
      if (!href) continue;

      const ariaHidden = attribute(tag, "aria-hidden")?.toLowerCase() === "true";
      const tabIndex = attribute(tag, "tabindex");
      if (ariaHidden && tabIndex !== "-1") {
        failures.push(
          `${normalizePath(new URL(page.url))} contains a focusable aria-hidden anchor: ${href}`,
        );
      }

      if (href.toLowerCase().includes(CONTACT_EMAIL)) {
        if (!href.toLowerCase().startsWith(`mailto:${CONTACT_EMAIL}`)) {
          failures.push(
            `${normalizePath(new URL(page.url))} exposes the contact email as a non-mailto link: ${href}`,
          );
        } else {
          contactMailtoOccurrences += 1;
        }
        if (ariaHidden) {
          failures.push(
            `${normalizePath(new URL(page.url))} hides the contact mailto from assistive technology`,
          );
        }
      }

      const destination = internalDestination(href, page.url, base);
      if (!destination) continue;
      const key = `${page.url}\n${destination}`;
      edges.set(key, { source: page.url, destination });
    }
  }

  const uniqueDestinations = new Set(
    [...edges.values()].map((edge) => edge.destination),
  );
  const unfetchedDestinations = [...uniqueDestinations].filter(
    (url) => !fetchedByUrl.has(url),
  );
  const destinationResults = await mapConcurrent(
    unfetchedDestinations,
    CONCURRENCY,
    fetchUrl,
  );
  for (const result of destinationResults) fetchedByUrl.set(result.url, result);

  for (const destination of uniqueDestinations) {
    const result = fetchedByUrl.get(destination);
    if (!result || !isValidDestination(result)) {
      const sources = [
        ...new Set(
          [...edges.values()]
            .filter((edge) => edge.destination === destination)
            .map((edge) => normalizePath(new URL(edge.source))),
        ),
      ];
      failures.push(
        `Internal destination ${normalizePath(new URL(destination))} from ${sources.join(", ")}: ${
          result ? describeFailure(result) : "not fetched"
        }`,
      );
    }
  }

  for (const expected of VERTICAL_REPLACEMENTS) {
    const source = new URL(expected.source, base).toString();
    const sourceDestinations = new Set(
      [...edges.values()]
        .filter((edge) => edge.source === source)
        .map((edge) => normalizePath(new URL(edge.destination))),
    );
    if (sourceDestinations.has(expected.stale)) {
      failures.push(`${expected.source} still links to stale ${expected.stale}`);
    }
    if (!sourceDestinations.has(expected.replacement)) {
      failures.push(
        `${expected.source} is missing live replacement ${expected.replacement}`,
      );
    }
  }

  console.log(`Sitemap pages validated: ${pageResults.length}`);
  console.log(`Anchor occurrences scanned: ${anchorOccurrences}`);
  console.log(`Internal source edges: ${edges.size}`);
  console.log(`Unique internal destinations validated: ${uniqueDestinations.size}`);
  console.log(`Accessible contact mailto occurrences: ${contactMailtoOccurrences}`);
  console.log(`Vertical replacement edges validated: ${VERTICAL_REPLACEMENTS.length}`);

  if (failures.length > 0) {
    console.error(`\nNews link audit failed with ${failures.length} issue(s):`);
    for (const failure of failures) console.error(`- ${failure}`);
    process.exitCode = 1;
    return;
  }

  console.log("\nNews link audit passed.");
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
