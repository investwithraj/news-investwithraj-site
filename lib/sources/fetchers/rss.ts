// RSS 2.0 + Atom feed parser — regex-based, zero dependencies.
// The feed formats we encounter are all standard enough that regex
// extraction is reliable + faster than pulling in fast-xml-parser.

import type { RawEntry, FetchResult } from "./types";
import type { VerifiedSource } from "@/lib/sources/registry";

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

/** Try to parse a date string into ISO. Falls back to "now" if unparseable. */
function toIso(s: string | null): string {
  if (!s) return new Date().toISOString();
  const d = new Date(s);
  if (isNaN(d.getTime())) return new Date().toISOString();
  return d.toISOString();
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

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(feedUrl, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept:
          "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
      },
      signal: controller.signal,
      // Don't cache during pipeline runs — we want fresh data each invocation
      cache: "no-store",
    });

    clearTimeout(timeout);

    if (!res.ok) {
      return {
        source,
        entries: [],
        error: `HTTP ${res.status} from ${feedUrl}`,
        durationMs: performance.now() - t0,
      };
    }

    const xml = await res.text();
    const domain = new URL(source.url).hostname.replace("www.", "");
    const isAtom = /<feed[\s>]/i.test(xml);

    let entries: RawEntry[];

    if (isAtom) {
      entries = parseAtomEntries(xml, source.name, source.tier, domain, limit);
    } else {
      entries = parseRssItems(xml, source.name, source.tier, domain, limit);
    }

    return {
      source,
      entries,
      error: null,
      durationMs: performance.now() - t0,
    };
  } catch (e) {
    clearTimeout(timeout);
    return {
      source,
      entries: [],
      error: e instanceof Error ? e.message : "Unknown fetch error",
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
  limit: number
): RawEntry[] {
  const itemBlocks = xml
    .split(/<item[\s>]/i)
    .slice(1)
    .map((b) => b.split(/<\/item>/i)[0]);

  const entries: RawEntry[] = [];
  for (const block of itemBlocks.slice(0, limit)) {
    const title = extract(/<title[^>]*>([\s\S]*?)<\/title>/, block);
    const link = extract(/<link[^>]*>([\s\S]*?)<\/link>/, block);
    const guid = extract(/<guid[^>]*>([\s\S]*?)<\/guid>/, block);
    const pubDate = extract(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/, block);
    const descriptionRaw =
      extract(/<description[^>]*>([\s\S]*?)<\/description>/, block) ||
      extract(/<content:encoded[^>]*>([\s\S]*?)<\/content:encoded>/, block) ||
      "";
    const categories = extractAll(/<category[^>]*>([\s\S]*?)<\/category>/g, block);

    if (!title || !link) continue;

    entries.push({
      id: guid || hashUrl(link),
      title,
      url: link,
      publishedAt: toIso(pubDate),
      summary: stripHtml(descriptionRaw).slice(0, 600),
      source: { name: sourceName, tier: sourceTier, domain },
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

    entries.push({
      id: id || hashUrl(link),
      title,
      url: link,
      publishedAt: toIso(published),
      summary: stripHtml(summaryRaw).slice(0, 600),
      source: { name: sourceName, tier: sourceTier, domain },
    });
  }
  return entries;
}
