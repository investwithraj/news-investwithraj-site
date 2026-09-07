// Lightweight, bounded article extractor. The network boundary remains in
// safe-fetch: HTTPS-only, allowlisted host, DNS-pinned, redirect-bounded,
// content-type checked and byte capped. This module only interprets the HTML
// returned from that boundary.

import { safeFetchBytes } from "@/lib/sources/safe-fetch";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const MAX_EXTRACT_CHARS = 50_000;
// Publisher pages can contain more than a megabyte of client-side application
// state. The verified AMP representations contain the same article metadata
// and copy without that payload, so article evidence stays inside a small,
// explicit memory ceiling instead of continually raising the generic limit.
const MAX_ARTICLE_RESPONSE_BYTES = 768 * 1024;

function normalisedHostname(value: string): string {
  return value.toLowerCase().replace(/^www\./, "");
}

/**
 * Return bounded, same-publisher representations in fetch order. These are
 * publisher-owned article URLs, not caches or extraction proxies. The original
 * URL remains the final fallback and every request still passes through the
 * HTTPS allowlist, DNS pinning and redirect checks in safe-fetch.
 */
export function publisherArticleFetchCandidates(value: string): string[] {
  let original: URL;
  try {
    original = new URL(value);
  } catch {
    return [value];
  }

  const candidates: string[] = [];
  const host = normalisedHostname(original.hostname);
  if (host === "khaleejtimes.com") {
    const amp = new URL(original);
    amp.searchParams.set("amp", "1");
    candidates.push(amp.toString());
  } else if (
    host === "gulfnews.com" &&
    !original.pathname.toLowerCase().startsWith("/amp/story/")
  ) {
    const amp = new URL(original);
    amp.pathname = `/amp/story${original.pathname}`;
    candidates.push(amp.toString());
  }
  candidates.push(original.toString());
  if (host === "wam.ae") {
    const match = original.pathname.match(
      /^\/en\/article\/([a-z0-9]+)-[a-z0-9-]+\/?$/iu,
    );
    if (match && !original.search && !original.hash) {
      const publisherApi = new URL(
        "/api/app/articles/GetArticleBySlug",
        original,
      );
      publisherApi.searchParams.set(
        "slug",
        original.pathname.replace(/^\/en\/article\//u, "").replace(/\/$/u, ""),
      );
      candidates.push(publisherApi.toString());
    }
  }
  return [...new Set(candidates)];
}

function wamPublisherApiCandidate(
  originalUrl: string,
  candidateUrl: string,
): { shortCode: string } | null {
  try {
    const original = new URL(originalUrl);
    const candidate = new URL(candidateUrl);
    const route = original.pathname
      .replace(/^\/en\/article\//u, "")
      .replace(/\/$/u, "");
    const match = route.match(/^([a-z0-9]+)-[a-z0-9-]+$/iu);
    if (
      !match ||
      original.protocol !== "https:" ||
      normalisedHostname(original.hostname) !== "wam.ae" ||
      original.search ||
      original.hash ||
      candidate.protocol !== "https:" ||
      candidate.hostname !== original.hostname ||
      candidate.pathname !== "/api/app/articles/GetArticleBySlug" ||
      candidate.hash ||
      candidate.searchParams.size !== 1 ||
      candidate.searchParams.get("slug") !== route
    ) {
      return null;
    }
    return { shortCode: match[1].toLowerCase() };
  } catch {
    return null;
  }
}

function normaliseArticleIdentity(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return null;
    let pathname: string;
    try {
      pathname = decodeURIComponent(url.pathname);
    } catch {
      pathname = url.pathname;
    }
    pathname = pathname.replace(/\/{2,}/g, "/").replace(/\/$/, "") || "/";
    return `${normalisedHostname(url.hostname)}${pathname}`.toLowerCase();
  } catch {
    return null;
  }
}

function normaliseFetchLocation(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return null;
    url.hash = "";
    url.hostname = normalisedHostname(url.hostname);
    url.pathname = url.pathname.replace(/\/{2,}/g, "/").replace(/\/$/, "") || "/";
    url.searchParams.sort();
    return url.toString().toLowerCase();
  } catch {
    return null;
  }
}

function publisherIdentityTargets(html: string): {
  canonical: string[];
  openGraph: string[];
} {
  const canonical: string[] = [];
  const openGraph: string[] = [];
  for (const match of html.matchAll(/<link\b[^>]*>/gi)) {
    const attributes = parseAttributes(match[0]);
    if (!(attributes.rel ?? "").toLowerCase().split(/\s+/).includes("canonical")) {
      continue;
    }
    canonical.push(attributes.href ?? "");
  }
  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attributes = parseAttributes(match[0]);
    const key = (attributes.property ?? attributes.name ?? "").toLowerCase();
    if (key === "og:url") openGraph.push(attributes.content ?? "");
  }
  return { canonical, openGraph };
}

function identitySetMatchesOriginal(
  targets: string[],
  baseUrl: string,
  originalIdentity: string,
): boolean {
  if (targets.length === 0) return false;
  const identities = targets.map((target) => {
    try {
      return normaliseArticleIdentity(new URL(target, baseUrl).toString());
    } catch {
      return null;
    }
  });
  if (identities.some((identity) => identity === null)) return false;
  const uniqueIdentities = new Set(identities);
  return uniqueIdentities.size === 1 && uniqueIdentities.has(originalIdentity);
}

/**
 * A synthetic lightweight URL is evidence only when the publisher page itself
 * declares that it represents the cited canonical article. Requiring this
 * proof prevents a 200 soft-404, homepage, or unrelated same-domain redirect
 * from becoming evidence merely because it has readable text and a date.
 */
export function publisherRepresentationMatchesCitation(
  html: string,
  originalUrl: string,
  requestedUrl: string,
  finalUrl: string,
): boolean {
  const originalFetchLocation = normaliseFetchLocation(originalUrl);
  const requestedFetchLocation = normaliseFetchLocation(requestedUrl);
  if (
    originalFetchLocation !== null &&
    requestedFetchLocation === originalFetchLocation
  ) {
    // A direct request needs no publisher metadata, but a redirect must still
    // resolve to the same canonical article identity. Merely remaining on the
    // publisher's domain is not enough.
    return (
      normaliseArticleIdentity(finalUrl) ===
      normaliseArticleIdentity(originalUrl)
    );
  }

  const originalIdentity = normaliseArticleIdentity(originalUrl);
  const requestedIdentity = normaliseArticleIdentity(requestedUrl);
  const finalIdentity = normaliseArticleIdentity(finalUrl);
  if (
    originalIdentity === null ||
    requestedIdentity === null ||
    finalIdentity === null ||
    (finalIdentity !== requestedIdentity && finalIdentity !== originalIdentity)
  ) {
    return false;
  }

  const targets = publisherIdentityTargets(html);
  // rel=canonical is the authoritative publisher identity signal. A matching
  // og:url must never override a conflicting canonical. Duplicate tags are
  // tolerated only when they all normalize to the same cited identity.
  if (targets.canonical.length > 0) {
    return identitySetMatchesOriginal(
      targets.canonical,
      finalUrl,
      originalIdentity,
    );
  }
  return identitySetMatchesOriginal(
    targets.openGraph,
    finalUrl,
    originalIdentity,
  );
}

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;|&rsquo;|&lsquo;/gi, "'")
    .replace(/&mdash;/gi, "—")
    .replace(/&ndash;/gi, "–")
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) =>
      String.fromCodePoint(Number.parseInt(n, 16)),
    )
    .replace(/&#(\d+);/g, (_, n: string) =>
      String.fromCodePoint(Number.parseInt(n, 10)),
    );
}

function parseAttributes(tag: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  const attributeRe =
    /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let first = true;
  for (const match of tag.matchAll(attributeRe)) {
    if (first) {
      first = false;
      continue;
    }
    attributes[match[1].toLowerCase()] = decodeEntities(
      match[2] ?? match[3] ?? match[4] ?? "",
    ).trim();
  }
  return attributes;
}

function parseJsonLdBlocks(html: string): unknown[] {
  const values: unknown[] = [];
  for (const match of html.matchAll(
    /<script\b[^>]*type\s*=\s*(?:"application\/ld\+json"|'application\/ld\+json'|application\/ld\+json)[^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    const raw = match[1]
      .replace(/^\s*<!--|-->\s*$/g, "")
      .replace(/^\s*<!\[CDATA\[|\]\]>\s*$/g, "")
      .trim();
    if (!raw) continue;
    try {
      values.push(JSON.parse(raw));
    } catch {
      // Invalid publisher metadata is ignored; it must never become evidence.
    }
  }
  return values;
}

function findJsonLdString(
  value: unknown,
  wantedKey: "datePublished" | "articleBody",
  state = { visited: 0 },
  depth = 0,
): string | null {
  if (depth > 12 || state.visited >= 2_000 || value === null) return null;
  state.visited += 1;
  if (Array.isArray(value)) {
    for (const child of value) {
      const found = findJsonLdString(child, wantedKey, state, depth + 1);
      if (found) return found;
    }
    return null;
  }
  if (typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (typeof record[wantedKey] === "string" && record[wantedKey].trim()) {
    return record[wantedKey].trim();
  }
  for (const child of Object.values(record)) {
    const found = findJsonLdString(child, wantedKey, state, depth + 1);
    if (found) return found;
  }
  return null;
}

function normaliseDate(raw: string): string | null {
  const value = decodeEntities(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const milliseconds = Date.parse(`${value}T00:00:00.000Z`);
    return Number.isFinite(milliseconds)
      ? new Date(milliseconds).toISOString()
      : null;
  }
  const zonedIso =
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:?\d{2})$/i;
  const rfc2822 =
    /^(?:(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun),\s+)?\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}\s+\d{2}:\d{2}(?::\d{2})?\s+(?:GMT|UTC|[+-]\d{4})$/i;
  if (!zonedIso.test(value) && !rfc2822.test(value)) return null;
  const milliseconds = Date.parse(value);
  return Number.isFinite(milliseconds) ? new Date(milliseconds).toISOString() : null;
}

export type PublicationDateSource =
  | "meta"
  | "json-ld"
  | "time"
  | "visible"
  | "publisher-api";

export interface ExtractedPublicationDate {
  publishedAt: string | null;
  source: PublicationDateSource | null;
}

const ENGLISH_MONTH_INDEX = new Map(
  [
    "january",
    "february",
    "march",
    "april",
    "may",
    "june",
    "july",
    "august",
    "september",
    "october",
    "november",
    "december",
  ].map((month, index) => [month, index]),
);

function normaliseCalendarMarkedDate(value: string): string | null {
  const match = value
    .replace(/\s+/g, " ")
    .trim()
    .match(/^([0-3]?\d) (January|February|March|April|May|June|July|August|September|October|November|December) ((?:19|20)\d{2})$/i);
  if (!match) return null;
  const day = Number.parseInt(match[1], 10);
  const month = ENGLISH_MONTH_INDEX.get(match[2].toLowerCase());
  const year = Number.parseInt(match[3], 10);
  if (month === undefined || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date.toISOString();
}

/** Some government newsrooms expose the publication date only as a visible,
 * calendar-marked header value. Accept one unambiguous long-form date from
 * that explicit UI affordance; an unmarked or conflicting date stays unknown. */
function extractCalendarMarkedVisibleDate(html: string): string | null {
  const candidates = new Set<string>();
  for (const match of html.matchAll(/<small\b[^>]*>([\s\S]*?)<\/small>/gi)) {
    const region = match[1];
    const calendarMarked = [...region.matchAll(/<i\b[^>]*>/gi)].some((icon) => {
      const attributes = parseAttributes(icon[0]);
      return /(?:^|\s)fa-calendar(?:-alt)?(?:\s|$)/i.test(
        attributes.class ?? "",
      );
    });
    if (!calendarMarked) continue;
    const visibleText = decodeEntities(region.replace(/<[^>]+>/g, " "));
    const publishedAt = normaliseCalendarMarkedDate(visibleText);
    if (publishedAt) candidates.add(publishedAt);
  }
  return candidates.size === 1 ? [...candidates][0] : null;
}

const DLD_INITIAL_REGISTRATION_PATH =
  "/en/news-media/dubai-land-department-launches-initial-registration-a-smarter-journey-for-developers-and-greater-efficiency-for-the-real-estate-sector";

function visiblePublicationDateAllowed(sourceUrl?: string): boolean {
  if (!sourceUrl) return false;
  try {
    const url = new URL(sourceUrl);
    const pathname = url.pathname.replace(/\/+$/u, "") || "/";
    return (
      url.protocol === "https:" &&
      url.hostname === "dubailand.gov.ae" &&
      !url.port &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      pathname === DLD_INITIAL_REGISTRATION_PATH
    );
  } catch {
    return false;
  }
}

function utcFromUaeComponents(input: {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  millisecond: number;
}): string | null {
  const { year, month, day, hour, minute, second, millisecond } = input;
  if (
    year < 2000 ||
    year > 2100 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59 ||
    second < 0 ||
    second > 59 ||
    millisecond < 0 ||
    millisecond > 999
  ) {
    return null;
  }
  const localCalendar = new Date(
    Date.UTC(year, month - 1, day, hour, minute, second, millisecond),
  );
  if (
    localCalendar.getUTCFullYear() !== year ||
    localCalendar.getUTCMonth() !== month - 1 ||
    localCalendar.getUTCDate() !== day ||
    localCalendar.getUTCHours() !== hour ||
    localCalendar.getUTCMinutes() !== minute ||
    localCalendar.getUTCSeconds() !== second ||
    localCalendar.getUTCMilliseconds() !== millisecond
  ) {
    return null;
  }
  return new Date(localCalendar.getTime() - 4 * 60 * 60 * 1_000).toISOString();
}

/** WAM article timestamps are UAE-local. Parse only its two observed explicit
 * formats and apply the fixed +04:00 offset without locale-dependent
 * Date.parse behavior. */
export function parseWamPublisherArticleDate(value: string): string | null {
  const uaeDisplay = value.match(
    /^(\d{2})\/(\d{2})\/(\d{4}) (\d{1,2}):(\d{2}):(\d{2}) (AM|PM)$/u,
  );
  if (uaeDisplay) {
    const hour12 = Number.parseInt(uaeDisplay[4], 10);
    if (hour12 < 1 || hour12 > 12) return null;
    const hour =
      (hour12 % 12) + (uaeDisplay[7] === "PM" ? 12 : 0);
    return utcFromUaeComponents({
      day: Number.parseInt(uaeDisplay[1], 10),
      month: Number.parseInt(uaeDisplay[2], 10),
      year: Number.parseInt(uaeDisplay[3], 10),
      hour,
      minute: Number.parseInt(uaeDisplay[5], 10),
      second: Number.parseInt(uaeDisplay[6], 10),
      millisecond: 0,
    });
  }

  const zonedIso = value.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?\+04:00$/u,
  );
  if (!zonedIso) return null;
  return utcFromUaeComponents({
    year: Number.parseInt(zonedIso[1], 10),
    month: Number.parseInt(zonedIso[2], 10),
    day: Number.parseInt(zonedIso[3], 10),
    hour: Number.parseInt(zonedIso[4], 10),
    minute: Number.parseInt(zonedIso[5], 10),
    second: Number.parseInt(zonedIso[6], 10),
    millisecond: Number.parseInt((zonedIso[7] ?? "0").padEnd(3, "0"), 10),
  });
}

/** WAM serves article pages as a client shell. Its public same-origin API is
 * accepted only when the request is derived from the cited route and the
 * response binds the route's immutable short code to an explicit article
 * date and non-empty article body. */
export function extractWamPublisherApiArticle(
  json: string,
  originalUrl: string,
  requestedUrl: string,
  finalUrl: string,
): {
  text: string;
  publishedAt: string;
  publicationDateSource: "publisher-api";
} | null {
  const identity = wamPublisherApiCandidate(originalUrl, requestedUrl);
  if (!identity || normaliseFetchLocation(requestedUrl) !== normaliseFetchLocation(finalUrl)) {
    return null;
  }
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch {
    return null;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (
    typeof record.shortCode !== "string" ||
    record.shortCode.toLowerCase() !== identity.shortCode ||
    typeof record.title !== "string" ||
    record.title.trim().length < 12 ||
    typeof record.body !== "string" ||
    typeof record.articleDate !== "string"
  ) {
    return null;
  }
  const publishedAt = parseWamPublisherArticleDate(record.articleDate);
  const text = extractMainText(`<article>${record.body}</article>`);
  if (!publishedAt || text.trim().length < 80) return null;
  return { text, publishedAt, publicationDateSource: "publisher-api" };
}

/** Extract an explicit publication timestamp. Modified/update timestamps and
 * ambiguous locale-only dates are deliberately rejected. */
export function extractPublicationDate(
  html: string,
  sourceUrl?: string,
): ExtractedPublicationDate {
  const metaKeys = new Set([
    "article:published_time",
    "og:published_time",
    "datepublished",
    "datecreated",
    "pubdate",
    "publishdate",
    "parsely-pub-date",
    "sailthru.date",
  ]);
  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attributes = parseAttributes(match[0]);
    const key = (
      attributes.property ??
      attributes.name ??
      attributes.itemprop ??
      ""
    ).toLowerCase();
    if (!metaKeys.has(key)) continue;
    const publishedAt = normaliseDate(attributes.content ?? attributes.datetime ?? "");
    if (publishedAt) return { publishedAt, source: "meta" };
  }

  for (const value of parseJsonLdBlocks(html)) {
    const raw = findJsonLdString(value, "datePublished");
    const publishedAt = raw ? normaliseDate(raw) : null;
    if (publishedAt) return { publishedAt, source: "json-ld" };
  }

  const markedTimes: string[] = [];
  const unmarkedTimes: string[] = [];
  for (const match of html.matchAll(/<time\b[^>]*>/gi)) {
    const attributes = parseAttributes(match[0]);
    const marker = `${attributes.itemprop ?? ""} ${attributes.class ?? ""} ${attributes.id ?? ""}`.toLowerCase();
    if (/modified|updated/.test(marker)) continue;
    const publishedAt = normaliseDate(attributes.datetime ?? "");
    if (!publishedAt) continue;
    if (/publish|datepublished|pubdate/.test(marker)) markedTimes.push(publishedAt);
    else unmarkedTimes.push(publishedAt);
  }
  const timeValue = markedTimes[0] ?? (unmarkedTimes.length === 1 ? unmarkedTimes[0] : null);
  if (timeValue) return { publishedAt: timeValue, source: "time" };

  const visibleDate = visiblePublicationDateAllowed(sourceUrl)
    ? extractCalendarMarkedVisibleDate(html)
    : null;
  return visibleDate
    ? { publishedAt: visibleDate, source: "visible" }
    : { publishedAt: null, source: null };
}

/** Pull readable body text out of an HTML page. */
export function extractMainText(html: string, maxChars = 9_000): string {
  const limit = Math.max(0, Math.min(MAX_EXTRACT_CHARS, Math.floor(maxChars)));
  if (limit === 0) return "";
  const cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ");
  const articleRegion =
    [...cleaned.matchAll(/<(?:article|main)\b[^>]*>([\s\S]*?)<\/(?:article|main)>/gi)]
      .map((match) => match[1])
      .sort((left, right) => right.length - left.length)[0] ?? cleaned;
  const publisherBodyRegion = [
    ...cleaned.matchAll(
      /<(?:div|section)\b[^>]*class\s*=\s*(?:"[^"]*(?:entry-content|article[-_ ]body|story[-_ ]body|article[-_ ]content|story[-_ ]content)[^"]*"|'[^']*(?:entry-content|article[-_ ]body|story[-_ ]body|article[-_ ]content|story[-_ ]content)[^']*')[^>]*>([\s\S]*?)<\/(?:div|section)>/gi,
    ),
  ].map((match) => match[1]).join(" ");
  const paragraphs = (region: string): string =>
    [...region.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
      .map((match) =>
        decodeEntities(match[1].replace(/<[^>]+>/g, " "))
          .replace(/\s+/g, " ")
          .trim(),
      )
      .filter((paragraph) => paragraph.length > 40)
      .join("  ");

  let text = [paragraphs(articleRegion), paragraphs(publisherBodyRegion)]
    .sort((left, right) => right.length - left.length)[0] ?? "";
  for (const value of parseJsonLdBlocks(html)) {
    const articleBody = findJsonLdString(value, "articleBody");
    if (articleBody) {
      const structuredText = decodeEntities(articleBody).replace(/\s+/g, " ").trim();
      if (structuredText.length > text.length) text = structuredText;
    }
  }
  if (text.length < 200) {
    text = decodeEntities(articleRegion.replace(/<[^>]+>/g, " "))
      .replace(/\s+/g, " ")
      .trim();
  }
  return text.slice(0, limit);
}

export type FetchDiagnosticCode =
  | "ok"
  | "blocked-url"
  | "dns"
  | "timeout"
  | "http"
  | "content-type"
  | "too-large"
  | "redirect"
  | "empty-text"
  | "fetch-error";

export interface FetchDiagnostic {
  code: FetchDiagnosticCode;
  message: string;
}

export interface FetchedArticleText {
  text: string;
  finalUrl: string | null;
  publishedAt: string | null;
  publicationDateSource: PublicationDateSource | null;
  diagnostic: FetchDiagnostic;
}

function classifyFetchError(message: string): FetchDiagnosticCode {
  if (/timed out|timeout/i.test(message)) return "timeout";
  if (/outside the approved|non-public|options are invalid/i.test(message)) return "blocked-url";
  if (/dns|resolves|unresolved|getaddrinfo|enotfound/i.test(message)) return "dns";
  if (/request failed \(\d+\)/i.test(message)) return "http";
  if (/response type|compressed/i.test(message)) return "content-type";
  if (/byte limit/i.test(message)) return "too-large";
  if (/redirect/i.test(message)) return "redirect";
  return "fetch-error";
}

/** Fetch a URL inside its verified-publisher boundary. */
export async function fetchArticleText(
  url: string,
  options: { allowedDomains: string[]; timeoutMs?: number },
): Promise<FetchedArticleText> {
  const timeoutMs = options.timeoutMs ?? 9_000;
  const deadline = Date.now() + timeoutMs;
  let bestResult: FetchedArticleText | null = null;
  let lastError: FetchedArticleText | null = null;

  for (const candidate of publisherArticleFetchCandidates(url)) {
    const remainingMs = deadline - Date.now();
    if (remainingMs < 1_000) break;
    try {
      const wamApi = wamPublisherApiCandidate(url, candidate);
      const result = await safeFetchBytes(candidate, {
        allowedDomains: options.allowedDomains,
        userAgent: UA,
        accept: wamApi
          ? "application/json"
          : "text/html,application/xhtml+xml",
        allowedContentTypes: wamApi
          ? /application\/json/i
          : /(?:text\/html|application\/xhtml\+xml)/i,
        maxBytes: MAX_ARTICLE_RESPONSE_BYTES,
        timeoutMs: remainingMs,
        maxRedirects: 3,
      });
      const html = result.bytes.toString("utf8");
      const apiArticle = wamApi
        ? extractWamPublisherApiArticle(
            html,
            url,
            candidate,
            result.finalUrl,
          )
        : null;
      if (
        (wamApi && !apiArticle) ||
        (!wamApi &&
          !publisherRepresentationMatchesCitation(
            html,
            url,
            candidate,
            result.finalUrl,
          ))
      ) {
        lastError = {
          text: "",
          finalUrl: null,
          publishedAt: null,
          publicationDateSource: null,
          diagnostic: {
            code: "redirect",
            message:
              "Publisher representation does not canonically identify the cited article.",
          },
        };
        continue;
      }
      const text = apiArticle?.text ?? extractMainText(html);
      const publicationDate = apiArticle
        ? {
            publishedAt: apiArticle.publishedAt,
            source: apiArticle.publicationDateSource,
          }
        : extractPublicationDate(html, url);
      const fetched: FetchedArticleText = {
        text,
        finalUrl: result.finalUrl,
        publishedAt: publicationDate.publishedAt,
        publicationDateSource: publicationDate.source,
        diagnostic: text.trim().length >= 80
          ? { code: "ok", message: `fetched ${text.length} readable characters` }
          : {
              code: "empty-text",
              message: `fetched HTML but extracted only ${text.trim().length} readable characters`,
            },
      };
      if (
        fetched.text.trim().length >= 80 &&
        fetched.publishedAt !== null &&
        fetched.publicationDateSource !== null
      ) {
        return fetched;
      }
      const fetchedScore =
        Number(fetched.text.trim().length >= 80) +
        Number(fetched.publishedAt !== null) +
        Number(fetched.finalUrl !== null);
      const bestScore = bestResult
        ? Number(bestResult.text.trim().length >= 80) +
          Number(bestResult.publishedAt !== null) +
          Number(bestResult.finalUrl !== null)
        : -1;
      if (fetchedScore > bestScore) bestResult = fetched;
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown source fetch failure";
      lastError = {
        text: "",
        finalUrl: null,
        publishedAt: null,
        publicationDateSource: null,
        diagnostic: { code: classifyFetchError(message), message },
      };
    }
  }

  return bestResult ?? lastError ?? {
    text: "",
    finalUrl: null,
    publishedAt: null,
    publicationDateSource: null,
    diagnostic: {
      code: "timeout",
      message: "Source fetch timed out before a publisher representation resolved.",
    },
  };
}
