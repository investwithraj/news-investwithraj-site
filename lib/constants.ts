// news.investwithraj.com — single source of truth for contact + cross-domain config.
// IWR root canonical URL is referenced for lead-back CTAs.

export const SITE = {
  url:
    process.env.NEXT_PUBLIC_SITE_URL ??
    "https://news.investwithraj.com",
  rootUrl: "https://investwithraj.com",
  name: "Invest With Raj Intelligence",
  tagline:
    "UAE real estate intelligence. Curated. Cited. Read like an analyst.",
  description:
    "Independent UAE real estate market intelligence covering market movements, launches, regulation, developers and communities across Dubai, Abu Dhabi and Ras Al Khaimah. Written for serious real estate decisions.",
};

export const CONTACT = {
  email: "office@investwithraj.com",
  whatsappNumber: "+971 58 996 6085",
  whatsappE164: "971589966085",
  linkedin: "https://www.linkedin.com/in/raj-tomar-1470a7242/",
  instagram: "https://www.instagram.com/thedubaiupgrade/",
  instagramHandle: "@thedubaiupgrade",
  youtube: "https://www.youtube.com/@TheDubaiUpgrade",
  youtubeHandle: "@TheDubaiUpgrade",
  linkedinNewsletter:
    "https://www.linkedin.com/build-relation/newsletter-follow?entityUrn=7363172445052170241",
  linkedinNewsletterName: "Beyond the Deal on LinkedIn",
} as const;

/** Public article identity until an individual signed-byline attestation exists. */
export const EDITORIAL = {
  articleByline: "Invest With Raj News Desk",
  articleRole: "Source-cited UAE real estate reporting",
  bylineUrl: `${SITE.url}/about/editorial-standards`,
} as const;

/** Lead-back CTA URLs — every news article footer points here, UTM-tagged. */
export function rootCtaUrl(opts: {
  campaign?: string;
  content?: string;
}): string {
  const params = new URLSearchParams({
    utm_source: "news",
    utm_medium: "internal",
    utm_campaign: opts.campaign ?? "article-footer",
    utm_content: opts.content ?? "request-the-note",
  });
  return `${SITE.rootUrl}/engage?${params.toString()}`;
}
