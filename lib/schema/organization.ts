// NewsMediaOrganization — the publication entity behind news.investwithraj.com.
// References the parent Organization at investwithraj.com via @id chain.

import { SITE, CONTACT } from "@/lib/constants";

/** Canonical NewsMediaOrganization schema for the news subdomain.
 *  Required by Google News for Publisher Center eligibility. */
export const newsOrgSchema = {
  "@context": "https://schema.org",
  "@type": "NewsMediaOrganization",
  "@id": `${SITE.url}#newsmediaorg`,
  name: SITE.name,
  url: SITE.url,
  logo: {
    "@type": "ImageObject",
    url: `${SITE.rootUrl}/publisher-logo.png`,
    width: 1000,
    height: 1000,
  },
  email: CONTACT.email,
  telephone: `+${CONTACT.whatsappE164}`,
  parentOrganization: { "@id": `${SITE.rootUrl}#organization` },
  founder: { "@id": `${SITE.rootUrl}#raj` },
  foundingDate: "2026-05-26",
  // Google News E-E-A-T requirements — point at editorial-standards page
  diversityPolicy: `${SITE.url}/about/editorial-standards`,
  ethicsPolicy: `${SITE.url}/about/editorial-standards`,
  masthead: `${SITE.url}/about`,
  missionCoveragePrioritiesPolicy: `${SITE.url}/about/editorial-standards`,
  verificationFactCheckingPolicy: `${SITE.url}/about/editorial-standards`,
  correctionsPolicy: `${SITE.url}/about/editorial-standards`,
  // Editorial focus
  knowsAbout: [
    "UAE Real Estate News",
    "Dubai Property Market",
    "Abu Dhabi Real Estate",
    "Ras Al Khaimah Real Estate",
    "DLD Transaction Data",
    "Off-Plan Property Launches",
    "Real Estate Investment Analysis",
  ],
  areaServed: [
    { "@type": "Place", name: "Dubai" },
    { "@type": "Place", name: "Abu Dhabi" },
    { "@type": "Place", name: "Ras Al Khaimah" },
    { "@type": "Country", name: "United Arab Emirates" },
  ],
  sameAs: [
    CONTACT.linkedin,
    CONTACT.linkedinNewsletter,
    CONTACT.instagram,
    CONTACT.youtube,
    SITE.rootUrl,
  ],
};

/** Reference object — for child schemas to point at the publisher */
export const newsOrgRef = { "@id": `${SITE.url}#newsmediaorg` };

/** Parent Organization reference — points at the IWR root canonical Org */
export const parentOrgRef = { "@id": `${SITE.rootUrl}#organization` };
