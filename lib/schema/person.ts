// Raj Tomar as Person — used as author on every article. Linked to the
// canonical Person entity at investwithraj.com/#raj via @id so Google
// understands "this is the same person as the one on the IWR root site."

import { SITE, CONTACT } from "@/lib/constants";

/** Canonical Person schema for Raj Tomar — author of every article. */
export const rajPersonSchema = {
  "@context": "https://schema.org",
  "@type": "Person",
  "@id": `${SITE.rootUrl}#raj`,
  name: "Raj Tomar",
  givenName: "Raj",
  familyName: "Tomar",
  jobTitle: "Real Estate Advisor",
  description:
    "Real estate advisor based in Dubai. 10+ years across the full property cycle in India and the UAE. Serial entrepreneur with deep international sales expertise, US market in particular.",
  url: `${SITE.rootUrl}/about`,
  mainEntityOfPage: `${SITE.rootUrl}/about`,
  image: `${SITE.rootUrl}/raj-avatar.jpg`,
  email: `mailto:${CONTACT.email}`,
  telephone: `+${CONTACT.whatsappE164}`,
  alumniOf: [
    {
      "@type": "EducationalOrganization",
      name: "Mahatma Gandhi University",
      department: "MBA, Construction Management",
    },
    {
      "@type": "EducationalOrganization",
      name: "Manipal University Jaipur",
      department: "B.Plan, Urban & Regional Planning",
    },
    {
      "@type": "EducationalOrganization",
      name: "The Wharton School",
      department: "Certificate, AI Applications in People Management",
    },
  ],
  knowsAbout: [
    "UAE Real Estate Investment",
    "Dubai Land Department (DLD) Regulations",
    "RERA Compliance",
    "Off-Plan Property Advisory",
    "Portfolio Strategy",
    "Cross-Border Real Estate Structuring",
    "Golden Visa Pathways",
    "Master Planning",
    "Feasibility Analysis",
    "Urban Planning",
    "Construction Management",
  ],
  hasCredential: [
    {
      "@type": "EducationalOccupationalCredential",
      name: "Licensed Real Estate Broker",
      credentialCategory: "license",
      recognizedBy: {
        "@type": "GovernmentOrganization",
        name: "Dubai Land Department",
        alternateName: "DLD",
        url: "https://dubailand.gov.ae",
        sameAs: "https://en.wikipedia.org/wiki/Dubai_Land_Department",
      },
      educationalLevel: "Professional License",
      validIn: { "@type": "Country", name: "United Arab Emirates" },
    },
  ],
  sameAs: [
    CONTACT.linkedin,
    CONTACT.linkedinNewsletter,
    CONTACT.instagram,
    CONTACT.youtube,
    `https://wa.me/${CONTACT.whatsappE164}`,
  ],
  address: {
    "@type": "PostalAddress",
    addressLocality: "Dubai",
    addressRegion: "Dubai",
    addressCountry: "AE",
  },
  worksFor: { "@id": `${SITE.rootUrl}#organization` },
};

/** Reference object — used inside Article.author to point at the
 *  canonical Person entity without re-emitting the full Person schema. */
export const rajPersonRef = { "@id": `${SITE.rootUrl}#raj` };
