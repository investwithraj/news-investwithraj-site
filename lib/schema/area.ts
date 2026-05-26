// JSON-LD generators for area pages — RealEstateAgent + Place + LocalBusiness.

import { SITE } from "@/lib/constants";
import type { AreaPage } from "@/content/areas/types";
import { rajPersonRef } from "./person";
import { newsOrgRef } from "./organization";

/** Place schema — the geographic anchor for an area page. */
export function placeSchema(area: AreaPage): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "Place",
    "@id": `${SITE.url}/areas/${area.slug}#place`,
    name: area.name,
    description: area.excerpt,
    geo: {
      "@type": "GeoCoordinates",
      latitude: area.coords.lat,
      longitude: area.coords.lng,
    },
    address: {
      "@type": "PostalAddress",
      addressRegion: area.emirate,
      addressCountry: "AE",
    },
    containedInPlace: {
      "@type": "Place",
      name: area.emirate,
      containedInPlace: { "@type": "Country", name: "United Arab Emirates" },
    },
  };
}

/** RealEstateAgent — schema that lets Google understand "this area page
 *  is hosted by a licensed broker who covers this geography." Drives
 *  local-results inclusion + broker-credential surfacing in search. */
export function realEstateAgentSchema(area: AreaPage): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "RealEstateAgent",
    "@id": `${SITE.url}/areas/${area.slug}#agent`,
    name: "Raj Tomar",
    url: SITE.rootUrl,
    image: `${SITE.rootUrl}/raj-avatar.jpg`,
    employee: rajPersonRef,
    parentOrganization: newsOrgRef,
    areaServed: {
      "@id": `${SITE.url}/areas/${area.slug}#place`,
    },
    knowsAbout: [
      `${area.name} real estate`,
      `${area.emirate} property market`,
      area.kind === "island" ? "Island development" : "Master-planned community",
      ...(area.developers.length > 0
        ? area.developers.map((d) => `${d} developments`)
        : []),
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
        },
        validIn: { "@type": "Country", name: "United Arab Emirates" },
      },
    ],
  };
}
