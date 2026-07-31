// Raj Tomar has one canonical entity across the advisory and publication.
// Keep this intentionally narrow: only claims visible on the public sites and
// controlled profile URLs belong in structured data.

import { CONTACT, SITE } from "@/lib/constants";

export const RAJ_PERSON_ID = `${SITE.rootUrl}#raj`;

/** Canonical Person schema used by public author and profile pages. */
export const rajPersonSchema = {
  "@context": "https://schema.org",
  "@type": "Person",
  "@id": RAJ_PERSON_ID,
  name: "Raj Tomar",
  jobTitle: "UAE Property Advisor and Publisher",
  description:
    "Dubai-based property advisor and named publisher of Invest With Raj Intelligence.",
  url: SITE.rootUrl,
  email: `mailto:${CONTACT.email}`,
  image: `${SITE.rootUrl}/media/real-uhd/raj-tomar-portrait.webp`,
  sameAs: [
    CONTACT.linkedin,
    CONTACT.linkedinNewsletter,
    CONTACT.instagram,
    CONTACT.youtube,
  ],
  worksFor: { "@id": `${SITE.url}#newsmediaorg` },
};

/** Reference object for Article.author and other linked schemas. */
export const rajPersonRef = { "@id": RAJ_PERSON_ID };
