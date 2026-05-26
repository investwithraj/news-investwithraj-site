// WebFetch wrapper for non-RSS sources (DLD / RERA / Knight Frank PDFs etc).
// Returns raw HTML which the schedule-skill Claude session then parses
// in-context using its native HTML reading capability.
//
// For the orchestrator script: we don't try to parse arbitrary HTML in
// Node — that's brittle. Instead we return URLs + last-fetch hash so
// Claude can WebFetch them with proper prompting during the drafting step.

import type { RawEntry, FetchResult } from "./types";
import type { VerifiedSource } from "@/lib/sources/registry";

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

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(source.url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      signal: controller.signal,
      cache: "no-store",
    });

    clearTimeout(timeout);

    if (!res.ok) {
      return {
        source,
        entries: [],
        error: `HTTP ${res.status} from ${source.url}`,
        durationMs: performance.now() - t0,
      };
    }

    const html = await res.text();
    const domain = new URL(source.url).hostname.replace("www.", "");
    const entries = extractCandidateLinks(html, source.url, source.name, source.tier, domain, limit);

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
  const contentPathRe = /\/(news|press|releases|research|insights|reports|publications|articles)\//i;
  const linkRe = /<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;

  const seen = new Set<string>();
  const entries: RawEntry[] = [];

  let m: RegExpExecArray | null;
  while ((m = linkRe.exec(html)) !== null && entries.length < limit * 3) {
    const href = m[1];
    const inner = m[2]
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (!contentPathRe.test(href)) continue;
    if (inner.length < 20) continue;
    if (inner.length > 200) continue; // probably a section block, not a headline

    let absoluteUrl: string;
    try {
      absoluteUrl = new URL(href, baseUrl).toString();
    } catch {
      continue;
    }
    if (seen.has(absoluteUrl)) continue;
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

function hashUrl(url: string): string {
  let h = 0;
  for (let i = 0; i < url.length; i++) {
    h = (h << 5) - h + url.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h).toString(36);
}
