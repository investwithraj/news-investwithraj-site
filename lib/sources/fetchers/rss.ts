// RSS 2.0 + Atom feed parser — regex-based, zero dependencies.
// The feed formats we encounter are all standard enough that regex
// extraction is reliable + faster than pulling in fast-xml-parser.

import type { RawEntry, FetchResult } from "./types";
import {
  findSourceByUrl,
  type VerifiedSource,
} from "@/lib/sources/registry";
import {
  safeFetchBytes,
  sourceFetchFailure,
  urlOnApprovedHost,
} from "@/lib/sources/safe-fetch";

const FETCH_TIMEOUT_MS = 15_000;
const USER_AGENT =
  "Mozilla/5.0 (compatible; InvestWithRajNewsBot/1.0; +https://news.investwithraj.com)";

/** Decode &amp; / &lt; / &gt; / &quot; / numeric refs / CDATA */
function decodeXml(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) =>
      String.fromCharCode(parseInt(n, 16))
    )
    .trim();
}

function extract(pattern: RegExp, source: string): string | null {
  const m = source.match(pattern);
  return m ? decodeXml(m[1]) : null;
}

function extractAll(pattern: RegExp, source: string): string[] {
  const out: string[] = [];
  let m: RegExpExecArray | null;
  const re = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : pattern.flags + "g");
  while ((m = re.exec(source)) !== null) {
    out.push(decodeXml(m[1]));
  }
  return out;
}

/** Strip HTML tags + normalize whitespace — for description extraction */
function stripHtml(s: string): string {
  return s
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Hash a URL into a stable short ID (for entries without GUID) */
function hashUrl(url: string): string {
  let h = 0;
  for (let i = 0; i < url.length; i++) {
    h = (h << 5) - h + url.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h).toString(36);
}

/** Parse an explicit publisher timestamp. Discovery time must never be used as
 * publication time: an undated or malformed feed item fails closed. */
function toIso(s: string | null): string | null {
  if (!s) return null;
  const d = new Date(s);
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}

/** Parse one already-fetched RSS/Atom document. Exported so source fixtures can
 * exercise the exact production parser without making network requests. */
export function parseRssDocument(
  xml: string,
  source: VerifiedSource,
  limit = 30,
): RawEntry[] {
  const domain = new URL(source.url).hostname.replace(/^www\./, "");
  const isAtom = /<feed[\s>]/i.test(xml);
  const isGoogleNews = domain === "news.google.com";
  const isBingNews = domain === "bing.com";
  const unverifiedAggregatorTier: VerifiedSource["tier"] =
    isGoogleNews || isBingNews ? "industry-portal" : source.tier;
  const entries = isAtom
    ? parseAtomEntries(
        xml,
        source.name,
        unverifiedAggregatorTier,
        domain,
        limit,
      )
    : parseRssItems(
        xml,
        source.name,
        source.tier,
        domain,
        limit,
        isGoogleNews,
        isBingNews,
      );
  return entries.filter((entry) => urlOnApprovedHost(entry.url, [domain]));
}

/** Bing still emits this one legacy HTTP wrapper in its RSS. Upgrade only the
 * exact same-host wrapper path before the normal HTTPS boundary is applied.
 * Every other HTTP URL remains unchanged and is rejected by urlOnApprovedHost. */
export function normalizeKnownBingNewsLink(
  value: string,
  feedDomain: string,
): string {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    if (
      feedDomain === "bing.com" &&
      url.protocol === "http:" &&
      host === "bing.com" &&
      url.pathname === "/news/apiclick.aspx" &&
      !url.username &&
      !url.password &&
      (!url.port || url.port === "80") &&
      !url.hash
    ) {
      url.protocol = "https:";
      url.port = "";
      return url.toString();
    }
  } catch {
    // The existing HTTPS/host validator rejects malformed values below.
  }
  return value;
}

/** Fetch + parse a single RSS or Atom feed. */
export async function fetchRssFeed(
  source: VerifiedSource,
  limit = 30
): Promise<FetchResult> {
  const t0 = performance.now();
  const feedUrl = source.rssUrl;
  if (!feedUrl) {
    return {
      source,
      entries: [],
      error: "No rssUrl configured on source",
      durationMs: 0,
    };
  }

  try {
    const sourceHost = new URL(source.url).hostname;
    const feedHost = new URL(feedUrl).hostname;
    const res = await safeFetchBytes(feedUrl, {
      allowedDomains: [sourceHost, feedHost],
      userAgent: USER_AGENT,
      accept:
        "application/rss+xml, application/atom+xml, application/xml, text/xml",
      allowedContentTypes:
        /(?:application\/(?:rss\+xml|atom\+xml|xml)|text\/xml)/i,
      maxBytes: 2 * 1024 * 1024,
      timeoutMs: FETCH_TIMEOUT_MS,
      maxRedirects: 3,
      // Don't cache during pipeline runs — we want fresh data each invocation
    });

    const xml = res.bytes.toString("utf8");
    const entries = parseRssDocument(xml, source, limit);

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
      error: e instanceof Error ? e.message : "Unknown fetch error",
      failure: sourceFetchFailure(e),
      durationMs: performance.now() - t0,
    };
  }
}

/** Parse RSS 2.0 <item> blocks */
function parseRssItems(
  xml: string,
  sourceName: string,
  sourceTier: VerifiedSource["tier"],
  domain: string,
  limit: number,
  isGoogleNews = false,
  isBingNews = false,
): RawEntry[] {
  const itemBlocks = xml
    .split(/<item[\s>]/i)
    .slice(1)
    .map((b) => b.split(/<\/item>/i)[0]);

  const entries: RawEntry[] = [];
  for (const block of itemBlocks.slice(0, limit)) {
    let title = extract(/<title[^>]*>([\s\S]*?)<\/title>/, block);
    const rawLink = extract(/<link[^>]*>([\s\S]*?)<\/link>/, block);
    const link = rawLink && isBingNews
      ? normalizeKnownBingNewsLink(rawLink, domain)
      : rawLink;
    const guid = extract(/<guid[^>]*>([\s\S]*?)<\/guid>/, block);
    const pubDate = extract(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/, block);
    const descriptionRaw =
      extract(/<description[^>]*>([\s\S]*?)<\/description>/, block) ||
      extract(/<content:encoded[^>]*>([\s\S]*?)<\/content:encoded>/, block) ||
      "";
    const categories = extractAll(/<category[^>]*>([\s\S]*?)<\/category>/g, block);

    if (!title || !link) continue;

    // Per-entry attribution. Google News tags each item with its real
    // publisher: <source url="https://publisher.com">Publisher</source>.
    // Lift it so the entry is attributed (and citable) to the actual outlet,
    // and strip the " - Publisher" suffix Google appends to the headline.
    let entryName = sourceName;
    let entryDomain = domain;
    let entryTier: VerifiedSource["tier"] =
      isGoogleNews || isBingNews ? "industry-portal" : sourceTier;
    if (isGoogleNews) {
      const sm = block.match(/<source[^>]*url="([^"]+)"[^>]*>([\s\S]*?)<\/source>/i);
      if (sm) {
        const pubName = decodeXml(sm[2]);
        const registeredPublisher = findSourceByUrl(sm[1]);
        try {
          entryDomain = new URL(sm[1]).hostname
            .toLowerCase()
            .replace(/^www\./, "");
        } catch {
          /* keep aggregator domain */
        }
        if (registeredPublisher) {
          entryName = registeredPublisher.name;
          entryTier = registeredPublisher.tier;
          entryDomain = new URL(registeredPublisher.url).hostname.replace(
            /^www\./,
            "",
          );
        } else {
          // Unknown Google publishers remain useful for discovery, but cannot
          // inherit the aggregator source's national-press ranking authority.
          entryName = pubName || sourceName;
        }
        if (pubName && title.endsWith(` - ${pubName}`)) {
          title = title.slice(0, -(` - ${pubName}`.length)).trim();
        }
      }
    }

    const publishedAt = toIso(pubDate);
    if (!publishedAt) continue;

    entries.push({
      id: guid || hashUrl(link),
      title,
      url: link,
      publishedAt,
      summary: stripHtml(descriptionRaw).slice(0, 600),
      source: { name: entryName, tier: entryTier, domain: entryDomain },
      categories: categories.length > 0 ? categories : undefined,
    });
  }
  return entries;
}

/** Parse Atom <entry> blocks */
function parseAtomEntries(
  xml: string,
  sourceName: string,
  sourceTier: VerifiedSource["tier"],
  domain: string,
  limit: number
): RawEntry[] {
  const entryBlocks = xml
    .split(/<entry[\s>]/i)
    .slice(1)
    .map((b) => b.split(/<\/entry>/i)[0]);

  const entries: RawEntry[] = [];
  for (const block of entryBlocks.slice(0, limit)) {
    const title = extract(/<title[^>]*>([\s\S]*?)<\/title>/, block);
    // Atom link is an attribute, not text content
    const linkMatch = block.match(/<link[^>]+href="([^"]+)"/i);
    const link = linkMatch ? decodeXml(linkMatch[1]) : null;
    const id = extract(/<id[^>]*>([\s\S]*?)<\/id>/, block);
    const published =
      extract(/<published[^>]*>([\s\S]*?)<\/published>/, block) ||
      extract(/<updated[^>]*>([\s\S]*?)<\/updated>/, block);
    const summaryRaw =
      extract(/<summary[^>]*>([\s\S]*?)<\/summary>/, block) ||
      extract(/<content[^>]*>([\s\S]*?)<\/content>/, block) ||
      "";

    if (!title || !link) continue;

    const publishedAt = toIso(published);
    if (!publishedAt) continue;

    entries.push({
      id: id || hashUrl(link),
      title,
      url: link,
      publishedAt,
      summary: stripHtml(summaryRaw).slice(0, 600),
      source: { name: sourceName, tier: sourceTier, domain },
    });
  }
  return entries;
}
