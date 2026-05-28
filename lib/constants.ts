// news.investwithraj.com — single source of truth for contact + cross-domain config.
// IWR root canonical URL is referenced for lead-back CTAs.

export const SITE = {
  url:
    process.env.NEXT_PUBLIC_SITE_URL ??
    "https://news.investwithraj.com",
  rootUrl: "https://investwithraj.com",
  name: "Invest With Raj — Daily Market Read",
  tagline:
    "Daily UAE real-estate intelligence. Curated. Cited. Read like an analyst.",
  description:
    "Independent UAE real-estate market intelligence. Weekly DLD transaction round-ups, monthly area deep-dives, plot-owner watchlists, and quarterly cycle reads. Every piece cites primary sources: DLD, RERA, Property Finder, Bayut, Knight Frank, JLL. Written for serious investors.",
};

export const CONTACT = {
  email: "office@investwithraj.com",
  whatsappNumber: "+971 58 996 6085",
  whatsappE164: "971589966085",
  linkedin: "https://www.linkedin.com/in/raj-tomar-1470a7242/",
  instagram: "https://www.instagram.com/rajtomar.dxb",
  instagramHandle: "@rajtomar.dxb",
  youtube: "https://www.youtube.com/@TheDubaiUpgrade",
  youtubeHandle: "@TheDubaiUpgrade",
  linkedinNewsletter:
    "https://www.linkedin.com/build-relation/newsletter-follow?entityUrn=7363172445052170241",
  linkedinNewsletterName: "Beyond the Deal on LinkedIn",
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
  return `${SITE.rootUrl}/?${params.toString()}`;
}
