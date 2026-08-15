// Lightweight, bounded article extractor. The network boundary remains in
// safe-fetch: HTTPS-only, allowlisted host, DNS-pinned, redirect-bounded,
// content-type checked and byte capped. This module only interprets the HTML
// returned from that boundary.

import { safeFetchBytes } from "@/lib/sources/safe-fetch";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const MAX_EXTRACT_CHARS = 50_000;

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

export type PublicationDateSource = "meta" | "json-ld" | "time";

export interface ExtractedPublicationDate {
  publishedAt: string | null;
  source: PublicationDateSource | null;
}

/** Extract an explicit publication timestamp. Modified/update timestamps and
 * ambiguous locale-only dates are deliberately rejected. */
export function extractPublicationDate(html: string): ExtractedPublicationDate {
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
  return timeValue
    ? { publishedAt: timeValue, source: "time" }
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
  const paras = [...articleRegion.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((match) =>
      decodeEntities(match[1].replace(/<[^>]+>/g, " "))
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter((paragraph) => paragraph.length > 40);

  let text = paras.join("  ");
  if (text.length < 200) {
    for (const value of parseJsonLdBlocks(html)) {
      const articleBody = findJsonLdString(value, "articleBody");
      if (articleBody && articleBody.length > text.length) {
        text = decodeEntities(articleBody).replace(/\s+/g, " ").trim();
      }
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
  try {
    const result = await safeFetchBytes(url, {
      allowedDomains: options.allowedDomains,
      userAgent: UA,
      accept: "text/html,application/xhtml+xml",
      allowedContentTypes: /(?:text\/html|application\/xhtml\+xml)/i,
      maxBytes: 512 * 1024,
      timeoutMs: options.timeoutMs ?? 9_000,
      maxRedirects: 3,
    });
    const html = result.bytes.toString("utf8");
    const text = extractMainText(html);
    const publicationDate = extractPublicationDate(html);
    return {
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
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown source fetch failure";
    return {
      text: "",
      finalUrl: null,
      publishedAt: null,
      publicationDateSource: null,
      diagnostic: { code: classifyFetchError(message), message },
    };
  }
}
