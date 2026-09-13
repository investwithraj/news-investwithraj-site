// WebFetch wrapper for non-RSS sources (DLD / RERA / Knight Frank PDFs etc).
// Returns raw HTML which the schedule-skill Claude session then parses
// in-context using its native HTML reading capability.
//
// For the orchestrator script: we don't try to parse arbitrary HTML in
// Node — that's brittle. Instead we return URLs + last-fetch hash so
// Claude can WebFetch them with proper prompting during the drafting step.

import type { RawEntry, FetchResult } from "./types";
import type { VerifiedSource } from "@/lib/sources/registry";
import {
  safeFetchBytes,
  sourceFetchFailure,
  urlOnApprovedHost,
} from "@/lib/sources/safe-fetch";

const FETCH_TIMEOUT_MS = 20_000;
const USER_AGENT =
  "Mozilla/5.0 (compatible; InvestWithRajNewsBot/1.0; +https://news.investwithraj.com)";

/** Fetch + extract a list of recent article links from a non-RSS source.
 *  For govt sources without feeds, we look for any <a> tags pointing at
 *  /press/, /news/, /releases/, /research/ paths and return them as
 *  candidate entries with a generic summary. The schedule-skill Claude
 *  session does the real content extraction in-context. */
export async function fetchWebPage(
  source: VerifiedSource,
  limit = 15
): Promise<FetchResult> {
  const t0 = performance.now();

  try {
    const fetchUrl = source.fetchUrl ?? source.url;
    const domain = new URL(source.url).hostname.replace("www.", "");
    const res = await safeFetchBytes(fetchUrl, {
      allowedDomains: [domain],
      userAgent: USER_AGENT,
      accept: "text/html,application/xhtml+xml",
      allowedContentTypes: /(?:text\/html|application\/xhtml\+xml)/i,
      maxBytes: 2 * 1024 * 1024,
      timeoutMs: FETCH_TIMEOUT_MS,
      maxRedirects: 3,
    });
    const html = res.bytes.toString("utf8");
    const entries = extractCandidateLinks(html, fetchUrl, source.name, source.tier, domain, limit);

    return {
      source,
      entries,
      error: null,
      durationMs: performance.now() - t0,
    };
  } catch (e) {
    return {
      source,
      entries: [],
      error: e instanceof Error ? e.message : "Unknown WebFetch error",
      failure: sourceFetchFailure(e),
      durationMs: performance.now() - t0,
    };
  }
}

/** Heuristic — extract article-shaped links from an HTML index page.
 *  Looks for <a> tags whose href contains content path keywords
 *  (/news/, /press/, /releases/, /research/, /insights/, /reports/)
 *  AND whose visible text is at least 20 chars (filters nav links). */
export function extractCandidateLinks(
  html: string,
  baseUrl: string,
  sourceName: string,
  sourceTier: VerifiedSource["tier"],
  domain: string,
  limit: number
): RawEntry[] {
  const contentPathRe = /\/(news(?:-and-media)?|latest-news|press(?:-release(?:s|-listing)?)?|releases|media-(?:centre|center)|research|insights|reports|publications|articles)(?:\/|-)/i;
  const linkRe = /<a\b[^>]*\bhref=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;

  const seen = new Set<string>();
  const entries: RawEntry[] = [];

  let m: RegExpExecArray | null;
  while ((m = linkRe.exec(html)) !== null && entries.length < limit * 3) {
    const href = m[1];
    let inner = decodeHtmlText(m[2]
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim());

    if (!contentPathRe.test(href)) continue;
    let absoluteUrl: string;
    try {
      absoluteUrl = new URL(href, baseUrl).toString();
    } catch {
      continue;
    }
    if (!urlOnApprovedHost(absoluteUrl, [domain])) continue;
    if (normaliseUrl(absoluteUrl) === normaliseUrl(baseUrl)) continue;
    if (seen.has(absoluteUrl)) continue;
    if (inner.length < 20 || inner.length > 200) {
      inner = headlineFromUrl(absoluteUrl);
    }
    if (inner.length < 20 || inner.length > 200) continue;
    const publishedAt = extractCandidatePublicationDate(
      html,
      m.index,
      m.index + m[0].length,
      absoluteUrl,
    );
    // Discovery time is not publication time. An undated link must wait for a
    // dated feed/index record instead of receiving a fabricated "now" value.
    if (!publishedAt) continue;
    seen.add(absoluteUrl);

    entries.push({
      id: hashUrl(absoluteUrl),
      title: inner,
      url: absoluteUrl,
      publishedAt,
      summary: `(WebFetch source — full content extracted in-session from ${sourceName})`,
      source: { name: sourceName, tier: sourceTier, domain },
    });
    if (entries.length >= limit) break;
  }

  return entries;
}

function exactCandidateDate(value: string): string | null {
  const trimmed = decodeHtmlText(value).trim();
  const dateOnly = trimmed.match(/^((?:19|20)\d{2})-(0[1-9]|1[0-2])-([012]\d|3[01])$/u);
  const datePrefix = trimmed.match(
    /^((?:19|20)\d{2})-(0[1-9]|1[0-2])-([012]\d|3[01])/u,
  );
  if (!datePrefix) return null;
  const sourceYear = Number(datePrefix[1]);
  const sourceMonth = Number(datePrefix[2]);
  const sourceDay = Number(datePrefix[3]);
  const calendarCheck = new Date(
    Date.UTC(sourceYear, sourceMonth - 1, sourceDay),
  );
  if (
    calendarCheck.getUTCFullYear() !== sourceYear ||
    calendarCheck.getUTCMonth() !== sourceMonth - 1 ||
    calendarCheck.getUTCDate() !== sourceDay
  ) {
    return null;
  }
  const candidate = dateOnly ? calendarCheck.toISOString() : trimmed;
  if (
    !dateOnly &&
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/u.test(
      candidate,
    )
  ) {
    return null;
  }
  const milliseconds = Date.parse(candidate);
  if (!Number.isFinite(milliseconds)) return null;
  return new Date(milliseconds).toISOString();
}

/** Extract only explicit publisher dates. URL calendar paths and a unique
 * semantic <time datetime> in the enclosing card are accepted; collection
 * time, file modification time and ambiguous prose dates are never used. */
export function extractCandidatePublicationDate(
  html: string,
  linkStart: number,
  linkEnd: number,
  absoluteUrl: string,
): string | null {
  const urlDate = new URL(absoluteUrl).pathname.match(
    /\/(?:((?:19|20)\d{2})[/-](0[1-9]|1[0-2])[/-]([012]\d|3[01]))(?:\/|$)/u,
  );
  if (urlDate) {
    const normalized = exactCandidateDate(
      `${urlDate[1]}-${urlDate[2]}-${urlDate[3]}`,
    );
    if (normalized) return normalized;
  }

  const articleStart = html.lastIndexOf("<article", linkStart);
  const articleEnd = articleStart >= 0 ? html.indexOf("</article>", linkEnd) : -1;
  const hasBoundedArticle =
    articleStart >= 0 && articleEnd >= linkEnd && articleEnd - articleStart <= 12_000;
  const context = hasBoundedArticle
    ? html.slice(articleStart, articleEnd + "</article>".length)
    : html.slice(Math.max(0, linkStart - 600), Math.min(html.length, linkEnd + 600));
  const dates = new Set<string>();
  for (const match of context.matchAll(
    /<time\b[^>]*\bdatetime=["']([^"']+)["'][^>]*>/giu,
  )) {
    const normalized = exactCandidateDate(match[1]);
    if (normalized) dates.add(normalized);
  }
  return dates.size === 1 ? [...dates][0] : null;
}

function normaliseUrl(value: string): string {
  try {
    const url = new URL(value);
    url.hash = "";
    url.search = "";
    return url.toString().replace(/\/$/, "").toLowerCase();
  } catch {
    return value.replace(/\/$/, "").toLowerCase();
  }
}

function headlineFromUrl(value: string): string {
  try {
    const slug = new URL(value).pathname.split("/").filter(Boolean).at(-1) ?? "";
    return decodeURIComponent(slug)
      .replace(/[-_]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  } catch {
    return "";
  }
}

function decodeHtmlText(value: string): string {
  return value
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&apos;|&#39;/gi, "'")
    .replace(/&nbsp;/gi, " ");
}

function hashUrl(url: string): string {
  let h = 0;
  for (let i = 0; i < url.length; i++) {
    h = (h << 5) - h + url.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h).toString(36);
}
