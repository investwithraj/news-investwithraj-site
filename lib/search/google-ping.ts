// Sitemap submission — modern path only.
//
// The legacy /ping endpoints we used here previously are dead:
//   - Google deprecated https://www.google.com/ping?sitemap= in mid-2023
//     (returns 404). Modern submission goes via Search Console API or, for
//     daily news, the news-sitemap discovered via robots.txt + ping-free
//     crawl pickup (typically within minutes once Search Console is
//     verified).
//   - Bing also retired https://www.bing.com/ping?sitemap= (returns 410
//     Gone). Modern submission goes via the Bing Webmaster Tools URL
//     Submission API, OR — preferably — via IndexNow, which Bing operates
//     and which Yandex/Yep/Seznam/Naver all subscribe to. We already
//     submit individual URLs via IndexNow in lib/search/indexnow.ts.
//
// Net effect: the post-publish webhook now reports a clean ok=true once
// IndexNow returns 200, instead of erroring on the dead /ping endpoints.
//
// If you want to push sitemaps to Google Search Console programmatically
// in future, the supported path is:
//   POST https://searchconsole.googleapis.com/webmasters/v3/sites/{siteUrl}/sitemaps/{feedpath}
// authenticated via a service account with Search Console owner role.
// That's an OAuth-flow rather than a public ping, so it lives in its own
// future task rather than this best-effort fanout.

import { SITE } from "@/lib/constants";

export interface SitemapPingResult {
  engine: "google" | "bing" | "indexnow-relay";
  sitemap: string;
  ok: boolean;
  statusCode: number;
  message: string;
}

/**
 * No-op shim retained for backward compatibility with any callers still
 * importing pingGoogleSitemap. Always returns a "skipped" successful result
 * since the underlying Google endpoint is dead — the actual signal goes
 * through IndexNow + Search Console's own crawl pickup.
 */
export async function pingGoogleSitemap(
  sitemapUrl: string = `${SITE.url}/sitemap.xml`
): Promise<SitemapPingResult> {
  return {
    engine: "google",
    sitemap: sitemapUrl,
    ok: true,
    statusCode: 200,
    message:
      "Google /ping deprecated since mid-2023 — relying on Search Console crawl + robots.txt sitemap discovery instead. No-op.",
  };
}

/**
 * No-op shim. Bing retired /ping in 2024. URL-level submission goes via
 * IndexNow (Bing-operated), which is already wired in indexnow.ts.
 */
export async function pingBingSitemap(
  sitemapUrl: string = `${SITE.url}/sitemap.xml`
): Promise<SitemapPingResult> {
  return {
    engine: "bing",
    sitemap: sitemapUrl,
    ok: true,
    statusCode: 200,
    message:
      "Bing /ping retired in 2024 — submissions handled by IndexNow (Bing-operated). No-op.",
  };
}

/**
 * Returns one synthesized "noop" result per sitemap so the response shape
 * stays stable for any external monitoring that watches for this array.
 * The actual submission work happens in lib/search/indexnow.ts.
 */
export async function pingAllSitemaps(): Promise<SitemapPingResult[]> {
  const sitemaps = [`${SITE.url}/sitemap.xml`, `${SITE.url}/news-sitemap.xml`];
  return sitemaps.map((s) => ({
    engine: "indexnow-relay" as const,
    sitemap: s,
    ok: true,
    statusCode: 200,
    message:
      "Sitemap discovery delegated to IndexNow + robots.txt. Legacy Google/Bing /ping endpoints retired.",
  }));
}
