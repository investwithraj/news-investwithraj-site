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
      durationMs: performance.now() - t0,
    };
  }
}

/** Heuristic — extract article-shaped links from an HTML index page.
 *  Looks for <a> tags whose href contains content path keywords
 *  (/news/, /press/, /releases/, /research/, /insights/, /reports/)
 *  AND whose visible text is at least 20 chars (filters nav links). */
function extractCandidateLinks(
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
    seen.add(absoluteUrl);

    entries.push({
      id: hashUrl(absoluteUrl),
      title: inner,
      url: absoluteUrl,
      // No reliable publishedAt from arbitrary HTML — use "now" as a
      // freshness signal that says "found on the index today."
      publishedAt: new Date().toISOString(),
      summary: `(WebFetch source — full content extracted in-session from ${sourceName})`,
      source: { name: sourceName, tier: sourceTier, domain },
    });
    if (entries.length >= limit) break;
  }

  return entries;
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
