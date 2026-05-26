// /news-sitemap.xml — Google News spec sitemap.
// Per the spec: only include articles published within the last 48 hours.
// Submit this URL separately to Google News Publisher Center (different
// from the regular sitemap.xml which is for general indexing).

import { SITE } from "@/lib/constants";
import { getNewsForGoogleNewsSitemap } from "@/content/news";

export const dynamic = "force-static";
export const revalidate = 3600; // hourly — must always be fresh per spec

const PUBLICATION_NAME = "Invest With Raj — Daily Market Read";
const PUBLICATION_LANG = "en";

export function GET(): Response {
  const articles = getNewsForGoogleNewsSitemap();

  const urls = articles
    .map((a) => {
      const url = `${SITE.url}/news/${a.slug}`;
      // Use escapeXml ONLY on user-controlled strings (title, etc).
      // Slugs are kebab-case by validator so they're safe.
      const escapedTitle = escapeXml(a.title);
      const escapedKeywords = escapeXml(
        [a.category, ...a.market].join(", ")
      );
      return `  <url>
    <loc>${url}</loc>
    <news:news>
      <news:publication>
        <news:name>${PUBLICATION_NAME}</news:name>
        <news:language>${PUBLICATION_LANG}</news:language>
      </news:publication>
      <news:publication_date>${a.publishedAt}</news:publication_date>
      <news:title>${escapedTitle}</news:title>
      <news:keywords>${escapedKeywords}</news:keywords>
    </news:news>
  </url>`;
    })
    .join("\n");

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset
  xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
  xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${urls || "  <!-- No articles published in the last 48 hours -->"}
</urlset>`;

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
