// Public entity for the editorial publication. Unsupported founding history,
// audience claims and missing remote artwork are deliberately excluded.

import { CONTACT, SITE } from "@/lib/constants";
import { RAJ_PERSON_ID } from "./person";

export const NEWS_ORG_ID = `${SITE.url}#newsmediaorg`;

export const newsOrgSchema = {
  "@context": "https://schema.org",
  "@type": "NewsMediaOrganization",
  "@id": NEWS_ORG_ID,
  name: SITE.name,
  url: SITE.url,
  description: SITE.description,
  logo: {
    "@type": "ImageObject",
    url: `${SITE.url}/icon.svg`,
    width: 512,
    height: 512,
  },
  email: CONTACT.email,
  founder: { "@id": RAJ_PERSON_ID },
  masthead: `${SITE.url}/about`,
  ethicsPolicy: `${SITE.url}/about/editorial-standards`,
  diversityPolicy: `${SITE.url}/about/editorial-standards`,
  correctionsPolicy: `${SITE.url}/about/editorial-standards#corrections`,
  verificationFactCheckingPolicy: `${SITE.url}/about/editorial-standards#evidence`,
  missionCoveragePrioritiesPolicy: `${SITE.url}/about`,
  publishingPrinciples: `${SITE.url}/about/editorial-standards`,
  sameAs: [
    CONTACT.linkedin,
    CONTACT.linkedinNewsletter,
    CONTACT.instagram,
    CONTACT.youtube,
  ],
};

export const newsOrgRef = { "@id": NEWS_ORG_ID };

/** Parent brand reference retained for existing linked-data consumers. */
export const parentOrgRef = { "@id": `${SITE.rootUrl}#organization` };
