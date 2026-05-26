// /rss.xml — RSS 2.0 feed for the news firehose.
// Used by:
//   - Feedly / Inoreader / NewsBlur subscribers (Tier D distribution)
//   - Medium / Substack / Beehiiv auto-import pipelines (Tier B reposts)
//   - News aggregators (Flipboard, SmartNews) for content ingestion
//   - Apple News Publisher feed
//
// Latest 30 news + insight articles, most recent first.

import { SITE, CONTACT } from "@/lib/constants";
import { getLatestNews } from "@/content/news";
import { getLatestInsights } from "@/content/insights";

export const dynamic = "force-static";
export const revalidate = 3600; // hourly

export function GET(): Response {
  const newsArticles = getLatestNews(20);
  const insightArticles = getLatestInsights(10);

  // Merge + sort
  type Entry = {
    title: string;
    description: string;
    url: string;
    publishedAt: string;
    category: string;
    image?: string;
  };
  const entries: Entry[] = [
    ...newsArticles.map((a) => ({
      title: a.title,
      description: a.subtitle,
      url: `${SITE.url}/news/${a.slug}`,
      publishedAt: a.publishedAt,
      category: a.category,
      image: a.heroImage.src.startsWith("http")
        ? a.heroImage.src
        : `${SITE.url}${a.heroImage.src}`,
    })),
    ...insightArticles.map((a) => ({
      title: a.title,
      description: a.excerpt,
      url: a.linkedinUrl ?? `${SITE.url}/insights/${a.slug}`,
      publishedAt: a.publishedAt,
      category: a.category,
      image: a.heroImage.src.startsWith("http")
        ? a.heroImage.src
        : `${SITE.url}${a.heroImage.src}`,
    })),
  ]
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    .slice(0, 30);

  const items = entries
    .map((e) => {
      const pubDate = new Date(e.publishedAt).toUTCString();
      return `    <item>
      <title>${escapeXml(e.title)}</title>
      <link>${e.url}</link>
      <guid isPermaLink="true">${e.url}</guid>
      <description>${escapeXml(e.description)}</description>
      <pubDate>${pubDate}</pubDate>
      <category>${escapeXml(e.category)}</category>
      <author>${CONTACT.email} (Raj Tomar)</author>
      ${e.image ? `<enclosure url="${escapeXml(e.image)}" type="image/jpeg" />` : ""}
    </item>`;
    })
    .join("\n");

  const lastBuild = new Date().toUTCString();

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
  xmlns:atom="http://www.w3.org/2005/Atom"
  xmlns:dc="http://purl.org/dc/elements/1.1/"
  xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>${escapeXml(SITE.name)}</title>
    <link>${SITE.url}</link>
    <atom:link href="${SITE.url}/rss.xml" rel="self" type="application/rss+xml" />
    <description>${escapeXml(SITE.description)}</description>
    <language>en-us</language>
    <copyright>© 2026 Raj Tomar</copyright>
    <managingEditor>${CONTACT.email} (Raj Tomar)</managingEditor>
    <webMaster>${CONTACT.email} (Raj Tomar)</webMaster>
    <pubDate>${lastBuild}</pubDate>
    <lastBuildDate>${lastBuild}</lastBuildDate>
    <ttl>60</ttl>
    <image>
      <url>${SITE.rootUrl}/publisher-logo.png</url>
      <title>${escapeXml(SITE.name)}</title>
      <link>${SITE.url}</link>
    </image>
${items || "    <!-- No articles published yet -->"}
  </channel>
</rss>`;

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
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
