// Google sitemap ping.
//
// Google deprecated the generic Indexing API for non-JobPosting /
// non-BroadcastEvent content in 2024. The sitemap ping endpoint is the
// still-supported fallback — Google's crawler reads sitemap.xml + the
// news-sitemap.xml within ~minutes of the ping.
//
// We also ping Bing's sitemap endpoint as a defense in depth (Bing is
// also reached via IndexNow, but the sitemap ping primes their crawler
// for the full sitemap rather than just individual URLs).

import { SITE } from "@/lib/constants";

export interface SitemapPingResult {
  engine: "google" | "bing";
  sitemap: string;
  ok: boolean;
  statusCode: number;
  message: string;
}

/** Ping Google's sitemap endpoint. Returns 200 on success. */
export async function pingGoogleSitemap(
  sitemapUrl: string = `${SITE.url}/sitemap.xml`
): Promise<SitemapPingResult> {
  const url = `https://www.google.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}`;
  try {
    const res = await fetch(url, { cache: "no-store" });
    return {
      engine: "google",
      sitemap: sitemapUrl,
      ok: res.ok,
      statusCode: res.status,
      message: res.ok ? "Google sitemap ping accepted" : `Google returned ${res.status}`,
    };
  } catch (e) {
    return {
      engine: "google",
      sitemap: sitemapUrl,
      ok: false,
      statusCode: 0,
      message: e instanceof Error ? e.message : "Unknown Google ping error",
    };
  }
}

/** Ping Bing's sitemap endpoint. */
export async function pingBingSitemap(
  sitemapUrl: string = `${SITE.url}/sitemap.xml`
): Promise<SitemapPingResult> {
  const url = `https://www.bing.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}`;
  try {
    const res = await fetch(url, { cache: "no-store" });
    return {
      engine: "bing",
      sitemap: sitemapUrl,
      ok: res.ok,
      statusCode: res.status,
      message: res.ok ? "Bing sitemap ping accepted" : `Bing returned ${res.status}`,
    };
  } catch (e) {
    return {
      engine: "bing",
      sitemap: sitemapUrl,
      ok: false,
      statusCode: 0,
      message: e instanceof Error ? e.message : "Unknown Bing ping error",
    };
  }
}

/** Ping both Google + Bing for the regular sitemap + news sitemap. */
export async function pingAllSitemaps(): Promise<SitemapPingResult[]> {
  const sitemaps = [`${SITE.url}/sitemap.xml`, `${SITE.url}/news-sitemap.xml`];
  const promises: Promise<SitemapPingResult>[] = [];
  for (const s of sitemaps) {
    promises.push(pingGoogleSitemap(s), pingBingSitemap(s));
  }
  return Promise.all(promises);
}
