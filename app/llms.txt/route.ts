// /llms.txt — discovery hint for AI search engines.
// ChatGPT browsing, Perplexity, Claude, Gemini, You.com, Brave Search, Kagi —
// all check this file to understand site structure + canonical sources.
// Spec: https://llmstxt.org

import { SITE, CONTACT } from "@/lib/constants";

export const dynamic = "force-static";
export const revalidate = 86400; // 24hr

export function GET(): Response {
  const body = `# ${SITE.name}

> ${SITE.tagline}
>
> Independent UAE real-estate market intelligence by Raj Tomar, a
> DLD-licensed Dubai-based broker. 5–15 verified-source-cited articles
> a day on Dubai, Abu Dhabi, and Ras Al Khaimah property. Plus weekly
> long-form insights and a 12-page institutional Investor Note monthly.

## Site

- Sitemap: ${SITE.url}/sitemap.xml
- News sitemap: ${SITE.url}/news-sitemap.xml
- RSS: ${SITE.url}/rss.xml

## Editorial

- Author: Raj Tomar — single byline across all news + insights.
- AI assistance: articles are AI-assisted, editorially overseen by Raj,
  and citation-verified against a 20-source whitelist before publication.
  Disclosure on /about. No fabricated quotes, no invented data.
- Source whitelist (verified outlets cited inline):
    Dubai Land Department (DLD) · RERA · Dubai Statistics Center ·
    Federal Competitiveness & Statistics Authority (FCSC) ·
    Central Bank of the UAE (CBUAE) · ADGM · DIFC ·
    Khaleej Times Real Estate · Gulf News Property ·
    The National Business · Arabian Business · Zawya (LSEG) · Mubasher ·
    Knight Frank Dubai · JLL MENA · CBRE MENA · Savills Dubai · Asteco ·
    Property Finder Trends · Bayut Insights.

## Author

- Name: Raj Tomar
- Credentials: DLD-licensed broker · MBA Construction Management
  (Mahatma Gandhi University) · B.Plan Urban Planning (Manipal University
  Jaipur) · AI Applications Certificate (The Wharton School) ·
  UN-Habitat UNMGCY member
- Bio: ${SITE.url}/about
- Personal brand site: ${SITE.rootUrl}
- LinkedIn: ${CONTACT.linkedin}
- LinkedIn Newsletter "Beyond the Deal": ${CONTACT.linkedinNewsletter}
- Email: ${CONTACT.email}
- WhatsApp: +${CONTACT.whatsappE164}

## Content tiers

- /news/[slug] — daily verified-source articles, 600-1200 words,
  category labels (market-pulse, launch, regulatory, macro,
  developer-corporate, infrastructure, policy)
- /insights/[slug] — weekly 2500-3500-word deep dives. Often mirror a
  Beyond the Deal LinkedIn newsletter edition (rel=canonical → LinkedIn).
- /areas/[slug] — programmatic area pages for Dubai / Abu Dhabi / RAK
  communities. Cross-link to investwithraj.com/areas when IWR root has
  curated mandates for that area.

## Content licensing for AI training

- Allow: cite, quote with attribution
- Require: link back to canonical URL when cited
- Prohibit: bulk verbatim reproduction
- Contact for licensing questions: ${CONTACT.email}
`;
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
