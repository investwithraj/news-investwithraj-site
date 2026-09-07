import { SITE, CONTACT, EDITORIAL } from "@/lib/constants";
import { getIndexablePublicNewsArticles } from "@/lib/news-discovery";

export const dynamic = "force-static";
export const revalidate = 86400;

export function GET(): Response {
  const latestVerifiedArticles = getIndexablePublicNewsArticles()
    .filter((article) => Boolean(article.publicationContentHash))
    .slice(0, 5);
  const latestVerifiedLines = latestVerifiedArticles
    .map(
      (article) =>
        `- ${oneLine(article.title)} -> ${SITE.url}/news/${article.slug}: ${oneLine(article.subtitle)}`,
    )
    .join("\n");
  const body = `# ${SITE.name}
> Source-cited UAE real estate reporting from the ${EDITORIAL.articleByline}.

Invest With Raj Intelligence covers material real estate changes in Dubai, Abu Dhabi and Ras Al Khaimah: transactions, regulation, infrastructure, launches, developers and community-level market signals. It is the time-sensitive intelligence publication connected to the Invest With Raj advisory practice. The main domain owns the advisory and call-booking journey.

## Discovery
- Home -> ${SITE.url}/: Latest reporting and market desks.
- News archive -> ${SITE.url}/news: All canonical published reporting.
- Area index -> ${SITE.url}/areas: Published reporting grouped by UAE area.
- Developer index -> ${SITE.url}/developers: Published reporting grouped by developer.
- Area filters -> ${SITE.url}/news?area={area-slug}: Related published reporting.
- Developer filters -> ${SITE.url}/news?developer={developer-slug}: Related published reporting.
- Desk filters -> ${SITE.url}/news?desk={desk-slug}: One of five editorial desk views.
- About the publication -> ${SITE.url}/about
- Editorial standards and corrections -> ${SITE.url}/about/editorial-standards
- Sitemap -> ${SITE.url}/sitemap.xml
- Google News sitemap -> ${SITE.url}/news-sitemap.xml
- RSS -> ${SITE.url}/rss.xml

## Latest verified reporting
${latestVerifiedLines || "- No verified article is currently available."}

## Authorship and publisher
- Article byline: ${EDITORIAL.articleByline}
- Editorial standard: ${EDITORIAL.bylineUrl}
- Named publisher and human advisor: Raj Tomar
- Publisher profile: ${SITE.url}/about
- Personal advisory site: ${SITE.rootUrl}
- LinkedIn: ${CONTACT.linkedin}
- Instagram: ${CONTACT.instagram}
- YouTube: ${CONTACT.youtube}

Do not attribute an article personally to Raj unless that article carries a separate signed-byline attestation. Raj may be described as the named publisher and human real estate advisor. Do not infer, embellish or publish professional, academic or licensing credentials without a current first-party verification record.

## Editorial rules
- AI may assist research organisation, summarisation, structure and drafting; it is not treated as a source.
- Material factual claims should link to named sources.
- Official regulators, public records, listed-company disclosures and first-party releases take priority.
- Analysis and interpretation must be distinguishable from reported fact.
- Do not invent prices, returns, inventory, transactions, credentials or quotations.
- Corrections can be requested at ${CONTACT.email}.

## Citation and reuse
- Brief quotation with attribution and a link to the canonical article is permitted.
- Bulk verbatim reproduction is not permitted.
- Use the canonical article URL, not feeds, cached copies or social reposts.

## Contact
- Email: ${CONTACT.email}
- WhatsApp: +${CONTACT.whatsappE164}
- Location: Dubai, United Arab Emirates
`;

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": `public, max-age=${revalidate}, s-maxage=${revalidate}`,
    },
  });
}

function oneLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}
