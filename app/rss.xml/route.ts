// /rss.xml — canonical, read-only RSS 2.0 feed for reviewed live news.

import { SITE, CONTACT } from "@/lib/constants";
import { getLatestNews } from "@/content/news";
import { hasVerifiedEditorialImage } from "@/lib/news-editorial";

export const dynamic = "force-static";
export const revalidate = 3600; // hourly

export function GET(): Response {
  const newsArticles = getLatestNews(30);

  type Entry = {
    title: string;
    description: string;
    url: string;
    publishedAt: string;
    category: string;
    image?: string;
    imageCredit?: string;
  };
  const entries: Entry[] = newsArticles
    .map((a) => ({
      title: a.title,
      description: a.subtitle,
      url: `${SITE.url}/news/${a.slug}`,
      publishedAt: a.publishedAt,
      category: a.category,
      image: hasVerifiedEditorialImage(a)
        ? absoluteUrl(a.heroImage.src)
        : undefined,
      imageCredit: hasVerifiedEditorialImage(a)
        ? a.heroImage.credit
        : undefined,
    }))
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));

  const items = entries
    .map((e) => {
      const pubDate = new Date(e.publishedAt).toUTCString();
      const escapedUrl = escapeXml(e.url);
      const imageMime = e.image ? imageMimeType(e.image) : null;
      return `    <item>
      <title>${escapeXml(e.title)}</title>
      <link>${escapedUrl}</link>
      <guid isPermaLink="true">${escapedUrl}</guid>
      <description>${escapeXml(e.description)}</description>
      <pubDate>${pubDate}</pubDate>
      <category>${escapeXml(e.category)}</category>
      <author>${CONTACT.email} (Raj Tomar)</author>
      ${e.image && imageMime ? `<media:content url="${escapeXml(e.image)}" type="${imageMime}" medium="image" />` : ""}
      ${e.imageCredit ? `<media:credit>${escapeXml(e.imageCredit)}</media:credit>` : ""}
    </item>`;
    })
    .join("\n");

  const lastBuild = new Date().toUTCString();

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
  xmlns:atom="http://www.w3.org/2005/Atom"
  xmlns:dc="http://purl.org/dc/elements/1.1/"
  xmlns:content="http://purl.org/rss/1.0/modules/content/"
  xmlns:media="http://search.yahoo.com/mrss/">
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
      <url>${SITE.url}/icon.svg</url>
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

function absoluteUrl(source: string): string | undefined {
  try {
    return new URL(source, SITE.url).toString();
  } catch {
    return undefined;
  }
}

function imageMimeType(source: string): string | null {
  let pathname: string;
  try {
    pathname = new URL(source).pathname.toLowerCase();
  } catch {
    return null;
  }
  if (pathname.endsWith(".jpg") || pathname.endsWith(".jpeg")) {
    return "image/jpeg";
  }
  if (pathname.endsWith(".png")) return "image/png";
  if (pathname.endsWith(".webp")) return "image/webp";
  if (pathname.endsWith(".avif")) return "image/avif";
  return null;
}
